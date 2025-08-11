import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { prisma } from '@/config/database.js'
import { AIService } from '@/services/ai.js'
import { rateLimitService } from '@/config/redis.js'
import { WhatsAppService } from '@/services/whatsapp.js'
import { EmailService } from '@/services/email.js'

// Validation schemas
const createReviewSchema = z.object({
  bookingId: z.string().min(1, 'ID da reserva é obrigatório'),
  rating: z.number().int().min(1, 'Nota mínima é 1').max(5, 'Nota máxima é 5'),
  title: z.string().min(3, 'Título muito curto').max(100, 'Título muito longo').optional(),
  content: z.string().min(10, 'Avaliação muito curta').max(2000, 'Avaliação muito longa'),
  
  // Detailed ratings
  cleanliness: z.number().int().min(1).max(5).optional(),
  accuracy: z.number().int().min(1).max(5).optional(),
  checkIn: z.number().int().min(1).max(5).optional(),
  communication: z.number().int().min(1).max(5).optional(),
  location: z.number().int().min(1).max(5).optional(),
  value: z.number().int().min(1).max(5).optional(),
  
  isPublic: z.boolean().default(true)
})

const updateReviewSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  title: z.string().min(3).max(100).optional(),
  content: z.string().min(10).max(2000).optional(),
  cleanliness: z.number().int().min(1).max(5).optional(),
  accuracy: z.number().int().min(1).max(5).optional(),
  checkIn: z.number().int().min(1).max(5).optional(),
  communication: z.number().int().min(1).max(5).optional(),
  location: z.number().int().min(1).max(5).optional(),
  value: z.number().int().min(1).max(5).optional(),
  isPublic: z.boolean().optional()
})

const reviewQuerySchema = z.object({
  propertyId: z.string().optional(),
  userId: z.string().optional(),
  rating: z.number().int().min(1).max(5).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(50).default(10),
  sortBy: z.enum(['newest', 'oldest', 'rating-high', 'rating-low', 'helpful']).default('newest'),
  includeReplies: z.boolean().default(true)
})

const reviewResponseSchema = z.object({
  content: z.string().min(5, 'Resposta muito curta').max(1000, 'Resposta muito longa')
})

export class ReviewsController {
  private aiService = new AIService()
  private whatsappService = new WhatsAppService()
  private emailService = new EmailService()

  // Create review
  async createReview(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = createReviewSchema.parse(request.body)
      const authorId = request.user!.id

      // Rate limiting
      const rateLimit = await rateLimitService.checkRateLimit(`review:${authorId}`, 86400, 5)
      if (!rateLimit.allowed) {
        return reply.status(429).send({
          error: 'Limite excedido',
          message: 'Você pode criar no máximo 5 avaliações por dia.'
        })
      }

      // Verify booking exists and belongs to user
      const booking = await prisma.booking.findUnique({
        where: { id: body.bookingId },
        include: {
          property: {
            include: {
              host: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  phone: true
                }
              }
            }
          },
          guest: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      })

      if (!booking) {
        return reply.status(404).send({
          error: 'Reserva não encontrada'
        })
      }

      if (booking.guestId !== authorId) {
        return reply.status(403).send({
          error: 'Acesso negado',
          message: 'Você só pode avaliar suas próprias reservas.'
        })
      }

      if (booking.status !== 'COMPLETED') {
        return reply.status(400).send({
          error: 'Reserva não concluída',
          message: 'Você só pode avaliar reservas concluídas.'
        })
      }

      // Check if review already exists
      const existingReview = await prisma.review.findFirst({
        where: {
          bookingId: body.bookingId,
          authorId: authorId
        }
      })

      if (existingReview) {
        return reply.status(409).send({
          error: 'Avaliação já existe',
          message: 'Você já avaliou esta reserva.'
        })
      }

      // Analyze review content with AI
      let sentiment = 'neutral'
      let aiTags: string[] = []

      if (this.aiService.getStatus().isReady) {
        try {
          const analysis = await this.aiService.analyzeReview(body.content)
          if (analysis) {
            sentiment = analysis.sentiment
            aiTags = analysis.tags
          }
        } catch (error) {
          console.warn('AI review analysis failed:', error)
        }
      }

      // Create review
      const review = await prisma.review.create({
        data: {
          bookingId: body.bookingId,
          propertyId: booking.propertyId,
          authorId: authorId,
          targetId: booking.property.host.id,
          rating: body.rating,
          title: body.title,
          content: body.content,
          cleanliness: body.cleanliness,
          accuracy: body.accuracy,
          checkIn: body.checkIn,
          communication: body.communication,
          location: body.location,
          value: body.value,
          isPublic: body.isPublic,
          sentiment: sentiment,
          aiTags: aiTags
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              avatar: true
            }
          },
          property: {
            select: {
              id: true,
              title: true,
              city: true,
              state: true
            }
          }
        }
      })

      // Update property and host average ratings
      await Promise.all([
        this.updatePropertyRating(booking.propertyId),
        this.updateHostRating(booking.property.host.id)
      ])

      // Send notifications to host
      try {
        const notificationMessage = `⭐ *Nova Avaliação Recebida*

Você recebeu uma nova avaliação de ${booking.guest.name}:

🏠 *Propriedade:* ${booking.property.title}
⭐ *Nota:* ${body.rating}/5 estrelas
📝 *Comentário:* "${body.content.substring(0, 100)}${body.content.length > 100 ? '...' : ''}"

🔗 *Ver avaliação completa:* hospedefacil.com.br/reviews/${review.id}

💬 Responda esta mensagem para comentar sobre a avaliação.`

        // Send WhatsApp notification
        if (booking.property.host.phone) {
          await this.whatsappService.sendMessage(booking.property.host.phone, notificationMessage)
        }

        // Send email notification
        await this.emailService.sendNewReviewNotification(
          booking.property.host.email,
          booking.property.host.name,
          review,
          booking
        )

      } catch (notificationError) {
        request.log.error('Failed to send review notifications:', notificationError)
      }

      return reply.status(201).send({
        message: 'Avaliação criada com sucesso!',
        review: {
          ...review,
          sentiment: sentiment,
          aiTags: aiTags
        }
      })

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Dados inválidos',
          details: error.errors
        })
      }

      request.log.error('Create review error:', error)
      return reply.status(500).send({
        error: 'Erro interno',
        message: 'Não foi possível criar a avaliação.'
      })
    }
  }

  // Get reviews
  async getReviews(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = reviewQuerySchema.parse(request.query)

      // Build where clause
      const where: any = {
        isPublic: true,
        isReported: false
      }

      if (query.propertyId) {
        where.propertyId = query.propertyId
      }

      if (query.userId) {
        where.OR = [
          { authorId: query.userId },
          { targetId: query.userId }
        ]
      }

      if (query.rating) {
        where.rating = query.rating
      }

      // Build sort order
      let orderBy: any = { createdAt: 'desc' }
      
      switch (query.sortBy) {
        case 'oldest':
          orderBy = { createdAt: 'asc' }
          break
        case 'rating-high':
          orderBy = { rating: 'desc' }
          break
        case 'rating-low':
          orderBy = { rating: 'asc' }
          break
        case 'helpful':
          // This would require a helpful votes system
          orderBy = { createdAt: 'desc' }
          break
      }

      const [reviews, totalCount] = await Promise.all([
        prisma.review.findMany({
          where,
          orderBy,
          skip: (query.page - 1) * query.limit,
          take: query.limit,
          include: {
            author: {
              select: {
                id: true,
                name: true,
                avatar: true,
                createdAt: true
              }
            },
            property: {
              select: {
                id: true,
                title: true,
                city: true,
                state: true,
                images: {
                  take: 1,
                  select: { url: true }
                }
              }
            },
            booking: {
              select: {
                checkIn: true,
                checkOut: true,
                nights: true
              }
            }
          }
        }),
        prisma.review.count({ where })
      ])

      // Get review responses if requested
      const reviewsWithResponses = query.includeReplies ? await Promise.all(
        reviews.map(async (review) => {
          const responses = await prisma.reviewResponse.findMany({
            where: { reviewId: review.id },
            include: {
              author: {
                select: {
                  id: true,
                  name: true,
                  avatar: true,
                  role: true
                }
              }
            },
            orderBy: { createdAt: 'asc' }
          })

          return {
            ...review,
            responses
          }
        })
      ) : reviews

      return reply.send({
        reviews: reviewsWithResponses,
        pagination: {
          page: query.page,
          limit: query.limit,
          total: totalCount,
          pages: Math.ceil(totalCount / query.limit)
        },
        filters: query
      })

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Parâmetros inválidos',
          details: error.errors
        })
      }

      request.log.error('Get reviews error:', error)
      return reply.status(500).send({
        error: 'Erro interno',
        message: 'Não foi possível carregar as avaliações.'
      })
    }
  }

  // Get single review
  async getReview(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string }

      const review = await prisma.review.findUnique({
        where: { id },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              avatar: true,
              createdAt: true
            }
          },
          target: {
            select: {
              id: true,
              name: true,
              avatar: true,
              role: true
            }
          },
          property: {
            select: {
              id: true,
              title: true,
              city: true,
              state: true,
              images: {
                take: 3,
                select: { url: true, alt: true }
              }
            }
          },
          booking: {
            select: {
              checkIn: true,
              checkOut: true,
              nights: true,
              guests: true
            }
          }
        }
      })

      if (!review) {
        return reply.status(404).send({
          error: 'Avaliação não encontrada'
        })
      }

      // Get responses
      const responses = await prisma.reviewResponse.findMany({
        where: { reviewId: review.id },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              avatar: true,
              role: true
            }
          }
        },
        orderBy: { createdAt: 'asc' }
      })

      return reply.send({
        ...review,
        responses
      })

    } catch (error) {
      request.log.error('Get review error:', error)
      return reply.status(500).send({
        error: 'Erro interno',
        message: 'Não foi possível carregar a avaliação.'
      })
    }
  }

  // Update review (author only)
  async updateReview(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string }
      const body = updateReviewSchema.parse(request.body)
      const userId = request.user!.id

      const review = await prisma.review.findUnique({
        where: { id },
        include: { property: true }
      })

      if (!review) {
        return reply.status(404).send({
          error: 'Avaliação não encontrada'
        })
      }

      if (review.authorId !== userId) {
        return reply.status(403).send({
          error: 'Acesso negado',
          message: 'Você só pode editar suas próprias avaliações.'
        })
      }

      // Check if review is not too old (e.g., 30 days)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      if (review.createdAt < thirtyDaysAgo) {
        return reply.status(400).send({
          error: 'Prazo expirado',
          message: 'Você só pode editar avaliações criadas nos últimos 30 dias.'
        })
      }

      // Re-analyze with AI if content changed
      let sentiment = review.sentiment
      let aiTags = review.aiTags

      if (body.content && body.content !== review.content && this.aiService.getStatus().isReady) {
        try {
          const analysis = await this.aiService.analyzeReview(body.content)
          if (analysis) {
            sentiment = analysis.sentiment
            aiTags = analysis.tags
          }
        } catch (error) {
          console.warn('AI review analysis failed:', error)
        }
      }

      const updatedReview = await prisma.review.update({
        where: { id },
        data: {
          ...body,
          sentiment,
          aiTags
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              avatar: true
            }
          }
        }
      })

      // Update ratings if rating changed
      if (body.rating && body.rating !== review.rating) {
        await Promise.all([
          this.updatePropertyRating(review.propertyId!),
          this.updateHostRating(review.targetId)
        ])
      }

      return reply.send({
        message: 'Avaliação atualizada com sucesso!',
        review: updatedReview
      })

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Dados inválidos',
          details: error.errors
        })
      }

      request.log.error('Update review error:', error)
      return reply.status(500).send({
        error: 'Erro interno',
        message: 'Não foi possível atualizar a avaliação.'
      })
    }
  }

  // Delete review (author only)
  async deleteReview(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string }
      const userId = request.user!.id
      const userRole = request.user!.role

      const review = await prisma.review.findUnique({
        where: { id },
        include: { property: true }
      })

      if (!review) {
        return reply.status(404).send({
          error: 'Avaliação não encontrada'
        })
      }

      // Only author or admin can delete
      if (review.authorId !== userId && userRole !== 'ADMIN') {
        return reply.status(403).send({
          error: 'Acesso negado',
          message: 'Você só pode excluir suas próprias avaliações.'
        })
      }

      // Soft delete
      await prisma.review.update({
        where: { id },
        data: { isPublic: false }
      })

      // Update ratings
      await Promise.all([
        this.updatePropertyRating(review.propertyId!),
        this.updateHostRating(review.targetId)
      ])

      return reply.send({
        message: 'Avaliação removida com sucesso!'
      })

    } catch (error) {
      request.log.error('Delete review error:', error)
      return reply.status(500).send({
        error: 'Erro interno',
        message: 'Não foi possível remover a avaliação.'
      })
    }
  }

  // Add response to review (host or admin only)
  async respondToReview(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string }
      const body = reviewResponseSchema.parse(request.body)
      const userId = request.user!.id
      const userRole = request.user!.role

      const review = await prisma.review.findUnique({
        where: { id },
        include: {
          property: {
            select: {
              hostId: true,
              title: true
            }
          }
        }
      })

      if (!review) {
        return reply.status(404).send({
          error: 'Avaliação não encontrada'
        })
      }

      // Only property host or admin can respond
      if (review.property?.hostId !== userId && userRole !== 'ADMIN') {
        return reply.status(403).send({
          error: 'Acesso negado',
          message: 'Apenas o anfitrião da propriedade pode responder a esta avaliação.'
        })
      }

      // Check if response already exists
      const existingResponse = await prisma.reviewResponse.findFirst({
        where: {
          reviewId: id,
          authorId: userId
        }
      })

      if (existingResponse) {
        return reply.status(409).send({
          error: 'Resposta já existe',
          message: 'Você já respondeu a esta avaliação.'
        })
      }

      const response = await prisma.reviewResponse.create({
        data: {
          reviewId: id,
          authorId: userId,
          content: body.content
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              avatar: true,
              role: true
            }
          }
        }
      })

      return reply.status(201).send({
        message: 'Resposta adicionada com sucesso!',
        response
      })

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Dados inválidos',
          details: error.errors
        })
      }

      request.log.error('Respond to review error:', error)
      return reply.status(500).send({
        error: 'Erro interno',
        message: 'Não foi possível adicionar a resposta.'
      })
    }
  }

  // Get reviews analytics (for hosts and admins)
  async getReviewAnalytics(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { propertyId } = request.query as any
      const userId = request.user!.id
      const userRole = request.user!.role

      let whereClause: any = { isPublic: true }

      if (propertyId) {
        // Verify property ownership if not admin
        if (userRole !== 'ADMIN') {
          const property = await prisma.property.findFirst({
            where: {
              id: propertyId,
              hostId: userId
            }
          })

          if (!property) {
            return reply.status(403).send({
              error: 'Acesso negado'
            })
          }
        }

        whereClause.propertyId = propertyId
      } else if (userRole === 'HOST') {
        whereClause.property = { hostId: userId }
      } else if (userRole !== 'ADMIN') {
        return reply.status(403).send({
          error: 'Acesso negado'
        })
      }

      const [
        ratingsDistribution,
        averageRatings,
        sentimentAnalysis,
        monthlyTrend,
        topTags
      ] = await Promise.all([
        this.getRatingsDistribution(whereClause),
        this.getAverageRatings(whereClause),
        this.getSentimentAnalysis(whereClause),
        this.getMonthlyReviewTrend(whereClause, 12),
        this.getTopReviewTags(whereClause, 10)
      ])

      return reply.send({
        summary: {
          ...averageRatings,
          ratingsDistribution
        },
        sentiment: sentimentAnalysis,
        trends: {
          monthly: monthlyTrend
        },
        insights: {
          topTags,
          improvementAreas: await this.getImprovementAreas(whereClause)
        }
      })

    } catch (error) {
      request.log.error('Review analytics error:', error)
      return reply.status(500).send({
        error: 'Erro interno',
        message: 'Não foi possível carregar as analytics de avaliações.'
      })
    }
  }

  // Helper methods
  private async updatePropertyRating(propertyId: string): Promise<void> {
    const ratings = await prisma.review.aggregate({
      where: {
        propertyId,
        isPublic: true
      },
      _avg: { rating: true },
      _count: { id: true }
    })

    await prisma.property.update({
      where: { id: propertyId },
      data: {
        averageRating: ratings._avg.rating || 0,
        reviewCount: ratings._count.id
      }
    })
  }

  private async updateHostRating(hostId: string): Promise<void> {
    const ratings = await prisma.review.aggregate({
      where: {
        targetId: hostId,
        isPublic: true
      },
      _avg: { rating: true }
    })

    await prisma.hostProfile.update({
      where: { userId: hostId },
      data: {
        averageRating: ratings._avg.rating || 0
      }
    })
  }

  private async getRatingsDistribution(whereClause: any): Promise<any> {
    const distribution = await prisma.review.groupBy({
      by: ['rating'],
      _count: { id: true },
      where: whereClause
    })

    const result = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    distribution.forEach(item => {
      result[item.rating as keyof typeof result] = item._count.id
    })

    return result
  }

  private async getAverageRatings(whereClause: any): Promise<any> {
    return await prisma.review.aggregate({
      where: whereClause,
      _avg: {
        rating: true,
        cleanliness: true,
        accuracy: true,
        checkIn: true,
        communication: true,
        location: true,
        value: true
      },
      _count: { id: true }
    })
  }

  private async getSentimentAnalysis(whereClause: any): Promise<any> {
    const sentiment = await prisma.review.groupBy({
      by: ['sentiment'],
      _count: { id: true },
      where: {
        ...whereClause,
        sentiment: { not: null }
      }
    })

    const result = { positive: 0, neutral: 0, negative: 0 }
    sentiment.forEach(item => {
      if (item.sentiment) {
        result[item.sentiment as keyof typeof result] = item._count.id
      }
    })

    return result
  }

  private async getMonthlyReviewTrend(whereClause: any, months: number): Promise<any[]> {
    // This would need to be implemented with proper date grouping
    return []
  }

  private async getTopReviewTags(whereClause: any, limit: number): Promise<any[]> {
    const reviews = await prisma.review.findMany({
      where: {
        ...whereClause,
        aiTags: { not: { equals: [] } }
      },
      select: { aiTags: true }
    })

    // Count tag frequency
    const tagCounts: Record<string, number> = {}
    reviews.forEach(review => {
      review.aiTags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1
      })
    })

    // Return top tags
    return Object.entries(tagCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([tag, count]) => ({ tag, count }))
  }

  private async getImprovementAreas(whereClause: any): Promise<string[]> {
    // This would analyze negative reviews to suggest improvements
    return ['Limpeza', 'Comunicação', 'Check-in']
  }
}

// Add ReviewResponse model to Prisma schema (this would be in schema.prisma)
// model ReviewResponse {
//   id        String   @id @default(cuid())
//   reviewId  String
//   review    Review   @relation(fields: [reviewId], references: [id], onDelete: Cascade)
//   authorId  String
//   author    User     @relation(fields: [authorId], references: [id], onDelete: Cascade)
//   content   String
//   createdAt DateTime @default(now())
//   updatedAt DateTime @updatedAt
//   
//   @@map("review_responses")
// }
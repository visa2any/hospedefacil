import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { prisma } from '@/config/database.js'
import { PricingService } from '@/services/pricing.js'

// Validation schemas
const pricingRecommendationSchema = z.object({
  propertyId: z.string().min(1, 'ID da propriedade é obrigatório'),
  startDate: z.string().datetime('Data inicial inválida').optional(),
  endDate: z.string().datetime('Data final inválida').optional(),
  days: z.number().int().min(1).max(365).default(30)
})

const applyPricingSchema = z.object({
  propertyId: z.string().min(1, 'ID da propriedade é obrigatório'),
  priceAdjustments: z.array(z.object({
    date: z.string().datetime('Data inválida'),
    price: z.number().positive('Preço deve ser positivo'),
    confidence: z.number().min(0).max(100).optional()
  })),
  applyOnlyHighConfidence: z.boolean().default(true)
})

const marketAnalysisSchema = z.object({
  city: z.string().min(2, 'Cidade é obrigatória'),
  state: z.string().length(2, 'Estado deve ter 2 caracteres'),
  propertyType: z.enum(['APARTMENT', 'HOUSE', 'CONDO', 'LOFT', 'STUDIO', 'FARM', 'CHALET', 'BOAT', 'OTHER']),
  bedrooms: z.number().int().min(0).max(20)
})

export class PricingController {
  private pricingService = new PricingService()

  // Get pricing recommendations for a property
  async getPricingRecommendations(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = pricingRecommendationSchema.parse(request.query)
      const hostId = request.user!.id

      // Verify property ownership
      const property = await prisma.property.findFirst({
        where: {
          id: query.propertyId,
          hostId: hostId
        },
        include: {
          amenities: {
            include: { amenity: true }
          }
        }
      })

      if (!property) {
        return reply.status(404).send({
          error: 'Propriedade não encontrada'
        })
      }

      // Calculate date range
      const startDate = query.startDate ? new Date(query.startDate) : new Date()
      const endDate = query.endDate 
        ? new Date(query.endDate) 
        : new Date(Date.now() + query.days * 24 * 60 * 60 * 1000)

      // Generate date array
      const dates = []
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        dates.push(new Date(d))
      }

      const context = {
        propertyId: property.id,
        basePrice: property.basePrice,
        dates,
        propertyType: property.type,
        bedrooms: property.bedrooms,
        location: {
          city: property.city,
          state: property.state,
          neighborhood: property.neighborhood
        },
        amenities: property.amenities.map(pa => pa.amenity.name),
        reviews: {
          count: property.reviewCount,
          averageRating: property.averageRating
        }
      }

      const recommendations = await this.pricingService.generatePricingRecommendations(context)

      // Calculate summary statistics
      const totalRevenueOriginal = recommendations.reduce((sum, r) => sum + r.originalPrice, 0)
      const totalRevenueRecommended = recommendations.reduce((sum, r) => sum + r.recommendedPrice, 0)
      const averageAdjustment = recommendations.reduce((sum, r) => sum + r.adjustmentPercentage, 0) / recommendations.length
      const highConfidenceRecommendations = recommendations.filter(r => r.confidence >= 70)

      return reply.send({
        property: {
          id: property.id,
          title: property.title,
          basePrice: property.basePrice,
          city: property.city,
          state: property.state
        },
        period: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          totalDays: recommendations.length
        },
        summary: {
          currentRevenue: totalRevenueOriginal,
          recommendedRevenue: totalRevenueRecommended,
          potentialIncrease: totalRevenueRecommended - totalRevenueOriginal,
          averageAdjustment: Math.round(averageAdjustment * 100) / 100,
          highConfidenceCount: highConfidenceRecommendations.length,
          averageConfidence: Math.round(recommendations.reduce((sum, r) => sum + r.confidence, 0) / recommendations.length)
        },
        recommendations: recommendations.map((rec, index) => ({
          ...rec,
          date: dates[index].toISOString().slice(0, 10)
        })),
        insights: {
          bestDays: recommendations
            .map((rec, index) => ({ ...rec, date: dates[index] }))
            .filter(r => r.adjustmentPercentage > 10)
            .sort((a, b) => b.adjustmentPercentage - a.adjustmentPercentage)
            .slice(0, 5),
          worstDays: recommendations
            .map((rec, index) => ({ ...rec, date: dates[index] }))
            .filter(r => r.adjustmentPercentage < -5)
            .sort((a, b) => a.adjustmentPercentage - b.adjustmentPercentage)
            .slice(0, 3)
        }
      })

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Parâmetros inválidos',
          details: error.errors
        })
      }

      request.log.error('Pricing recommendations error:', error)
      return reply.status(500).send({
        error: 'Erro interno',
        message: 'Não foi possível gerar recomendações de preços.'
      })
    }
  }

  // Apply pricing recommendations to property
  async applyPricingRecommendations(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = applyPricingSchema.parse(request.body)
      const hostId = request.user!.id

      // Verify property ownership
      const property = await prisma.property.findFirst({
        where: {
          id: body.propertyId,
          hostId: hostId
        }
      })

      if (!property) {
        return reply.status(404).send({
          error: 'Propriedade não encontrada'
        })
      }

      let appliedCount = 0
      let skippedCount = 0

      // Apply each price adjustment
      for (const adjustment of body.priceAdjustments) {
        // Skip low confidence adjustments if requested
        if (body.applyOnlyHighConfidence && adjustment.confidence && adjustment.confidence < 70) {
          skippedCount++
          continue
        }

        try {
          await prisma.propertyAvailability.upsert({
            where: {
              propertyId_date: {
                propertyId: body.propertyId,
                date: new Date(adjustment.date)
              }
            },
            update: {
              price: adjustment.price
            },
            create: {
              propertyId: body.propertyId,
              date: new Date(adjustment.date),
              price: adjustment.price,
              isBlocked: false
            }
          })

          appliedCount++
        } catch (error) {
          skippedCount++
          request.log.warn('Failed to apply pricing for date:', adjustment.date, error)
        }
      }

      // Log the pricing update
      await prisma.pricingRule.create({
        data: {
          propertyId: body.propertyId,
          name: 'Manual Pricing Application',
          type: 'MANUAL',
          isActive: true,
          conditions: {
            appliedCount,
            skippedCount,
            totalAdjustments: body.priceAdjustments.length,
            appliedAt: new Date()
          }
        }
      })

      return reply.send({
        message: 'Preços aplicados com sucesso!',
        results: {
          applied: appliedCount,
          skipped: skippedCount,
          total: body.priceAdjustments.length
        }
      })

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Dados inválidos',
          details: error.errors
        })
      }

      request.log.error('Apply pricing error:', error)
      return reply.status(500).send({
        error: 'Erro interno',
        message: 'Não foi possível aplicar os preços.'
      })
    }
  }

  // Enable/disable automatic pricing for a property
  async toggleAutomaticPricing(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { propertyId } = request.params as { propertyId: string }
      const { enabled } = request.body as { enabled: boolean }
      const hostId = request.user!.id

      // Verify property ownership
      const property = await prisma.property.findFirst({
        where: {
          id: propertyId,
          hostId: hostId
        }
      })

      if (!property) {
        return reply.status(404).send({
          error: 'Propriedade não encontrada'
        })
      }

      // Update automatic pricing status
      await prisma.property.update({
        where: { id: propertyId },
        data: { 
          automaticPricing: enabled,
          updatedAt: new Date()
        }
      })

      // If enabled, apply automatic pricing immediately
      if (enabled) {
        try {
          await this.pricingService.applyAutomaticPricing(propertyId)
        } catch (error) {
          request.log.warn('Failed to apply initial automatic pricing:', error)
        }
      }

      return reply.send({
        message: `Precificação automática ${enabled ? 'ativada' : 'desativada'} com sucesso!`,
        automaticPricing: enabled
      })

    } catch (error) {
      request.log.error('Toggle automatic pricing error:', error)
      return reply.status(500).send({
        error: 'Erro interno',
        message: 'Não foi possível atualizar a configuração de preços.'
      })
    }
  }

  // Get market analysis for an area
  async getMarketAnalysis(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = marketAnalysisSchema.parse(request.query)

      // Get market data
      const properties = await prisma.property.findMany({
        where: {
          city: query.city,
          state: query.state,
          type: query.propertyType,
          bedrooms: query.bedrooms,
          status: 'ACTIVE'
        },
        select: {
          basePrice: true,
          averageRating: true,
          reviewCount: true,
          totalBookings: true,
          totalEarnings: true,
          createdAt: true,
          bookings: {
            where: {
              status: { in: ['CONFIRMED', 'COMPLETED'] },
              createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
            },
            select: {
              totalPrice: true,
              nights: true
            }
          }
        }
      })

      if (properties.length === 0) {
        return reply.send({
          location: query,
          marketInsights: {
            message: 'Dados de mercado insuficientes para esta localização e tipo de propriedade.',
            competitorCount: 0,
            averagePrice: 0,
            priceRange: { min: 0, max: 0 },
            averageRating: 0,
            monthlyBookings: 0
          }
        })
      }

      // Calculate market metrics
      const prices = properties.map(p => p.basePrice)
      const ratings = properties.filter(p => p.averageRating > 0).map(p => p.averageRating)
      const recentBookings = properties.reduce((sum, p) => sum + p.bookings.length, 0)

      const averagePrice = prices.reduce((a, b) => a + b, 0) / prices.length
      const averageRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0
      const medianPrice = prices.sort((a, b) => a - b)[Math.floor(prices.length / 2)]

      // Price distribution
      const priceRanges = {
        'R$ 0-100': prices.filter(p => p < 100).length,
        'R$ 100-200': prices.filter(p => p >= 100 && p < 200).length,
        'R$ 200-300': prices.filter(p => p >= 200 && p < 300).length,
        'R$ 300-500': prices.filter(p => p >= 300 && p < 500).length,
        'R$ 500+': prices.filter(p => p >= 500).length,
      }

      // Performance tiers
      const topPerformers = properties
        .filter(p => p.averageRating >= 4.5 && p.reviewCount >= 10)
        .sort((a, b) => b.totalEarnings - a.totalEarnings)
        .slice(0, 5)

      return reply.send({
        location: {
          city: query.city,
          state: query.state,
          propertyType: query.propertyType,
          bedrooms: query.bedrooms
        },
        marketInsights: {
          competitorCount: properties.length,
          averagePrice: Math.round(averagePrice),
          medianPrice: Math.round(medianPrice),
          priceRange: {
            min: Math.min(...prices),
            max: Math.max(...prices)
          },
          averageRating: Math.round(averageRating * 100) / 100,
          monthlyBookings: recentBookings,
          occupancyEstimate: Math.min((recentBookings / properties.length) * 100 / 30, 100),
          priceDistribution: priceRanges,
          recommendations: {
            suggestedPriceRange: {
              min: Math.round(averagePrice * 0.8),
              max: Math.round(averagePrice * 1.2)
            },
            competitivePrice: Math.round(averagePrice * 0.95),
            premiumPrice: Math.round(averagePrice * 1.15)
          }
        },
        topPerformers: topPerformers.map(p => ({
          basePrice: p.basePrice,
          averageRating: p.averageRating,
          reviewCount: p.reviewCount,
          totalBookings: p.totalBookings,
          totalEarnings: p.totalEarnings,
          monthlyBookings: p.bookings.length
        })),
        trends: {
          priceGrowth: 'Dados insuficientes', // Would need historical data
          demandTrend: recentBookings > properties.length * 2 ? 'Alta' : 
                      recentBookings > properties.length ? 'Média' : 'Baixa',
          seasonality: this.analyzeSeasonality(new Date())
        }
      })

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Parâmetros inválidos',
          details: error.errors
        })
      }

      request.log.error('Market analysis error:', error)
      return reply.status(500).send({
        error: 'Erro interno',
        message: 'Não foi possível realizar a análise de mercado.'
      })
    }
  }

  // Get pricing history for a property
  async getPricingHistory(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { propertyId } = request.params as { propertyId: string }
      const hostId = request.user!.id

      // Verify property ownership
      const property = await prisma.property.findFirst({
        where: {
          id: propertyId,
          hostId: hostId
        }
      })

      if (!property) {
        return reply.status(404).send({
          error: 'Propriedade não encontrada'
        })
      }

      // Get pricing rules history
      const pricingRules = await prisma.pricingRule.findMany({
        where: { propertyId },
        orderBy: { createdAt: 'desc' },
        take: 50
      })

      // Get recent availability pricing changes
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      const availabilityPricing = await prisma.propertyAvailability.findMany({
        where: {
          propertyId,
          date: { gte: thirtyDaysAgo },
          price: { not: property.basePrice }
        },
        orderBy: { date: 'asc' }
      })

      return reply.send({
        property: {
          id: property.id,
          title: property.title,
          basePrice: property.basePrice,
          automaticPricing: property.automaticPricing
        },
        history: {
          rules: pricingRules,
          customPricing: availabilityPricing.map(a => ({
            date: a.date.toISOString().slice(0, 10),
            price: a.price,
            adjustment: ((a.price - property.basePrice) / property.basePrice * 100).toFixed(1)
          }))
        },
        summary: {
          totalRules: pricingRules.length,
          activeRules: pricingRules.filter(r => r.isActive).length,
          customPricingDays: availabilityPricing.length,
          averageCustomPrice: availabilityPricing.length > 0 
            ? Math.round(availabilityPricing.reduce((sum, a) => sum + a.price, 0) / availabilityPricing.length)
            : property.basePrice
        }
      })

    } catch (error) {
      request.log.error('Pricing history error:', error)
      return reply.status(500).send({
        error: 'Erro interno',
        message: 'Não foi possível carregar o histórico de preços.'
      })
    }
  }

  // Helper method to analyze seasonality
  private analyzeSeasonality(date: Date): string {
    const month = date.getMonth()
    
    if (month >= 11 || month <= 1) return 'Alta temporada (Verão)'
    if (month === 2 || month === 6) return 'Temporada moderada'
    if ((month >= 3 && month <= 4) || (month >= 7 && month <= 9)) return 'Baixa temporada'
    
    return 'Temporada média'
  }
}
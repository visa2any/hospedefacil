import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { prisma } from '@/config/database.js'
import { cacheService } from '@/config/redis.js'
import { EmailService } from '@/services/email.js'
import { WhatsAppService } from '@/services/whatsapp.js'

// Validation schemas
const userQuerySchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  role: z.enum(['GUEST', 'HOST', 'ADMIN']).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'BANNED']).optional(),
  search: z.string().optional(),
  sortBy: z.enum(['newest', 'oldest', 'name', 'email', 'lastLogin']).default('newest')
})

const propertyModerationSchema = z.object({
  propertyId: z.string().min(1),
  action: z.enum(['APPROVE', 'REJECT', 'SUSPEND', 'REQUEST_CHANGES']),
  reason: z.string().max(1000),
  changes_requested: z.array(z.string()).optional()
})

const userModerationSchema = z.object({
  userId: z.string().min(1),
  action: z.enum(['VERIFY', 'SUSPEND', 'BAN', 'ACTIVATE', 'MAKE_HOST', 'REVOKE_HOST']),
  reason: z.string().max(1000),
  duration: z.number().int().positive().optional() // days
})

const platformSettingsSchema = z.object({
  commissionRate: z.number().min(0).max(1).optional(),
  hostFeeRate: z.number().min(0).max(1).optional(),
  taxRate: z.number().min(0).max(1).optional(),
  maxBookingDays: z.number().int().positive().optional(),
  cancellationWindowHours: z.number().int().positive().optional(),
  enableAutomaticApproval: z.boolean().optional(),
  enableDynamicPricing: z.boolean().optional(),
  maintenanceMode: z.boolean().optional()
})

const analyticsQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  period: z.enum(['7d', '30d', '90d', '1y', 'all']).default('30d'),
  metric: z.enum(['revenue', 'bookings', 'users', 'properties']).optional()
})

export class AdminController {
  private emailService = new EmailService()
  private whatsappService = new WhatsAppService()

  // Dashboard overview
  async getDashboard(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { period = '30d' } = request.query as any

      // Calculate date range
      const endDate = new Date()
      const startDate = new Date()
      switch (period) {
        case '7d':
          startDate.setDate(endDate.getDate() - 7)
          break
        case '30d':
          startDate.setDate(endDate.getDate() - 30)
          break
        case '90d':
          startDate.setDate(endDate.getDate() - 90)
          break
        case '1y':
          startDate.setFullYear(endDate.getFullYear() - 1)
          break
      }

      const [
        userStats,
        propertyStats,
        bookingStats,
        revenueStats,
        pendingApprovals,
        recentActivity,
        systemHealth
      ] = await Promise.all([
        this.getUserStats(startDate, endDate),
        this.getPropertyStats(startDate, endDate),
        this.getBookingStats(startDate, endDate),
        this.getRevenueStats(startDate, endDate),
        this.getPendingApprovals(),
        this.getRecentActivity(20),
        this.getSystemHealth()
      ])

      return reply.send({
        period,
        overview: {
          users: userStats,
          properties: propertyStats,
          bookings: bookingStats,
          revenue: revenueStats
        },
        pendingActions: {
          ...pendingApprovals,
          total: pendingApprovals.properties + pendingApprovals.hosts + pendingApprovals.disputes
        },
        recentActivity,
        systemHealth,
        quickActions: [
          { id: 'approve_properties', title: 'Aprovar Propriedades', count: pendingApprovals.properties },
          { id: 'verify_hosts', title: 'Verificar Anfitriões', count: pendingApprovals.hosts },
          { id: 'resolve_disputes', title: 'Resolver Disputas', count: pendingApprovals.disputes },
          { id: 'review_reports', title: 'Revisar Denúncias', count: pendingApprovals.reports },
          { id: 'system_monitoring', title: 'Monitoramento', status: systemHealth.overall }
        ]
      })

    } catch (error) {
      request.log.error('Admin dashboard error:', error)
      return reply.status(500).send({
        error: 'Erro interno',
        message: 'Não foi possível carregar o dashboard administrativo.'
      })
    }
  }

  // User Management
  async getUsers(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = userQuerySchema.parse(request.query)

      const whereClause: any = {}
      
      if (query.role) whereClause.role = query.role
      if (query.status) whereClause.status = query.status
      if (query.search) {
        whereClause.OR = [
          { name: { contains: query.search, mode: 'insensitive' } },
          { email: { contains: query.search, mode: 'insensitive' } }
        ]
      }

      const orderBy = this.buildUserOrderBy(query.sortBy)

      const [users, totalCount] = await Promise.all([
        prisma.user.findMany({
          where: whereClause,
          include: {
            hostProfile: {
              select: {
                id: true,
                totalEarnings: true,
                totalBookings: true,
                averageRating: true,
                isSuperHost: true,
                identityVerified: true
              }
            },
            _count: {
              select: {
                bookingsAsGuest: true,
                properties: true,
                reviews: true
              }
            }
          },
          orderBy,
          skip: (query.page - 1) * query.limit,
          take: query.limit
        }),
        prisma.user.count({ where: whereClause })
      ])

      return reply.send({
        users: users.map(user => ({
          ...user,
          // Remove sensitive fields
          password: undefined,
          socialId: undefined,
          emailVerificationToken: undefined,
          phoneVerificationCode: undefined
        })),
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

      request.log.error('Get users error:', error)
      return reply.status(500).send({
        error: 'Erro interno'
      })
    }
  }

  // User moderation actions
  async moderateUser(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = userModerationSchema.parse(request.body)
      const adminId = request.user!.id

      const user = await prisma.user.findUnique({
        where: { id: body.userId },
        include: { hostProfile: true }
      })

      if (!user) {
        return reply.status(404).send({
          error: 'Usuário não encontrado'
        })
      }

      let updateData: any = {}
      let logAction = ''

      switch (body.action) {
        case 'VERIFY':
          updateData = { 
            emailVerified: true,
            phoneVerified: true,
            status: 'ACTIVE'
          }
          logAction = 'User verified'
          break

        case 'SUSPEND':
          updateData = { status: 'SUSPENDED' }
          if (body.duration) {
            const suspensionEnd = new Date()
            suspensionEnd.setDate(suspensionEnd.getDate() + body.duration)
            updateData.suspensionEnd = suspensionEnd
          }
          logAction = 'User suspended'
          break

        case 'BAN':
          updateData = { status: 'BANNED' }
          logAction = 'User banned'
          break

        case 'ACTIVATE':
          updateData = { 
            status: 'ACTIVE',
            suspensionEnd: null
          }
          logAction = 'User activated'
          break

        case 'MAKE_HOST':
          // Create host profile if doesn't exist
          if (!user.hostProfile) {
            await prisma.hostProfile.create({
              data: {
                userId: user.id,
                identityVerified: true,
                backgroundCheck: true
              }
            })
          }
          updateData = { role: 'HOST' }
          logAction = 'User made host'
          break

        case 'REVOKE_HOST':
          updateData = { role: 'GUEST' }
          // Deactivate properties
          await prisma.property.updateMany({
            where: { hostId: user.id },
            data: { status: 'INACTIVE' }
          })
          logAction = 'Host privileges revoked'
          break
      }

      // Update user
      const updatedUser = await prisma.user.update({
        where: { id: body.userId },
        data: updateData
      })

      // Log admin action
      await prisma.adminLog.create({
        data: {
          adminId,
          action: logAction,
          entityType: 'USER',
          entityId: body.userId,
          details: {
            reason: body.reason,
            duration: body.duration,
            previousStatus: user.status
          }
        }
      })

      // Send notification to user
      try {
        const notificationMessage = this.getUserModerationMessage(body.action, body.reason)
        await this.emailService.sendEmail({
          to: user.email,
          subject: notificationMessage.subject,
          html: notificationMessage.html
        })
      } catch (error) {
        request.log.warn('Failed to send user notification:', error)
      }

      return reply.send({
        message: 'Ação executada com sucesso!',
        user: {
          ...updatedUser,
          password: undefined,
          socialId: undefined,
          emailVerificationToken: undefined,
          phoneVerificationCode: undefined
        }
      })

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Dados inválidos',
          details: error.errors
        })
      }

      request.log.error('Moderate user error:', error)
      return reply.status(500).send({
        error: 'Erro interno'
      })
    }
  }

  // Property Management
  async getPropertiesForReview(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { page = 1, limit = 20 } = request.query as any

      const [properties, totalCount] = await Promise.all([
        prisma.property.findMany({
          where: {
            status: { in: ['DRAFT', 'UNDER_REVIEW', 'SUSPENDED'] }
          },
          include: {
            host: {
              select: {
                id: true,
                name: true,
                email: true,
                hostProfile: {
                  select: {
                    identityVerified: true,
                    averageRating: true,
                    totalBookings: true
                  }
                }
              }
            },
            images: {
              take: 3,
              select: { url: true, alt: true }
            },
            _count: {
              select: { reviews: true, bookings: true }
            }
          },
          orderBy: { createdAt: 'asc' },
          skip: (page - 1) * limit,
          take: limit
        }),
        prisma.property.count({
          where: { status: { in: ['DRAFT', 'UNDER_REVIEW', 'SUSPENDED'] } }
        })
      ])

      return reply.send({
        properties,
        pagination: {
          page,
          limit,
          total: totalCount,
          pages: Math.ceil(totalCount / limit)
        }
      })

    } catch (error) {
      request.log.error('Get properties for review error:', error)
      return reply.status(500).send({
        error: 'Erro interno'
      })
    }
  }

  // Property moderation
  async moderateProperty(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = propertyModerationSchema.parse(request.body)
      const adminId = request.user!.id

      const property = await prisma.property.findUnique({
        where: { id: body.propertyId },
        include: { host: true }
      })

      if (!property) {
        return reply.status(404).send({
          error: 'Propriedade não encontrada'
        })
      }

      let newStatus = ''
      let logAction = ''

      switch (body.action) {
        case 'APPROVE':
          newStatus = 'ACTIVE'
          logAction = 'Property approved'
          break
        case 'REJECT':
          newStatus = 'INACTIVE'
          logAction = 'Property rejected'
          break
        case 'SUSPEND':
          newStatus = 'SUSPENDED'
          logAction = 'Property suspended'
          break
        case 'REQUEST_CHANGES':
          newStatus = 'UNDER_REVIEW'
          logAction = 'Property changes requested'
          break
      }

      // Update property
      const updatedProperty = await prisma.property.update({
        where: { id: body.propertyId },
        data: { 
          status: newStatus,
          moderationNotes: body.reason,
          moderatedAt: new Date(),
          moderatedBy: adminId
        }
      })

      // Log admin action
      await prisma.adminLog.create({
        data: {
          adminId,
          action: logAction,
          entityType: 'PROPERTY',
          entityId: body.propertyId,
          details: {
            reason: body.reason,
            changes_requested: body.changes_requested,
            previousStatus: property.status
          }
        }
      })

      // Notify host
      try {
        const notificationMessage = this.getPropertyModerationMessage(body.action, body.reason, property.title)
        await this.emailService.sendEmail({
          to: property.host.email,
          subject: notificationMessage.subject,
          html: notificationMessage.html
        })
      } catch (error) {
        request.log.warn('Failed to send property notification:', error)
      }

      return reply.send({
        message: 'Propriedade moderada com sucesso!',
        property: updatedProperty
      })

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Dados inválidos',
          details: error.errors
        })
      }

      request.log.error('Moderate property error:', error)
      return reply.status(500).send({
        error: 'Erro interno'
      })
    }
  }

  // Financial Management
  async getFinancialOverview(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = analyticsQuerySchema.parse(request.query)
      const { startDate, endDate } = this.calculateDateRange(query.period)

      const [
        totalRevenue,
        platformCommission,
        payoutsPending,
        payoutsCompleted,
        transactionVolume,
        topEarningHosts
      ] = await Promise.all([
        this.getTotalRevenue(startDate, endDate),
        this.getPlatformCommission(startDate, endDate),
        this.getPayoutsPending(),
        this.getPayoutsCompleted(startDate, endDate),
        this.getTransactionVolume(startDate, endDate),
        this.getTopEarningHosts(startDate, endDate, 10)
      ])

      return reply.send({
        period: query.period,
        overview: {
          totalRevenue,
          platformCommission,
          payoutsPending,
          payoutsCompleted,
          transactionVolume,
          profitMargin: totalRevenue > 0 ? (platformCommission / totalRevenue * 100) : 0
        },
        topEarningHosts,
        trends: await this.getRevenueTrends(startDate, endDate)
      })

    } catch (error) {
      request.log.error('Financial overview error:', error)
      return reply.status(500).send({
        error: 'Erro interno'
      })
    }
  }

  // Platform Settings
  async getPlatformSettings(request: FastifyRequest, reply: FastifyReply) {
    try {
      const settings = await prisma.platformSetting.findMany({
        orderBy: { key: 'asc' }
      })

      const settingsMap = settings.reduce((acc: any, setting) => {
        acc[setting.key] = {
          value: setting.value,
          type: setting.type,
          description: setting.description,
          updatedAt: setting.updatedAt
        }
        return acc
      }, {})

      return reply.send({ settings: settingsMap })

    } catch (error) {
      request.log.error('Get platform settings error:', error)
      return reply.status(500).send({
        error: 'Erro interno'
      })
    }
  }

  async updatePlatformSettings(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = platformSettingsSchema.parse(request.body)
      const adminId = request.user!.id

      const updates = []
      
      for (const [key, value] of Object.entries(body)) {
        if (value !== undefined) {
          updates.push(
            prisma.platformSetting.upsert({
              where: { key },
              update: { 
                value: JSON.stringify(value),
                updatedAt: new Date()
              },
              create: {
                key,
                value: JSON.stringify(value),
                type: typeof value,
                description: `Auto-generated setting for ${key}`
              }
            })
          )
        }
      }

      await Promise.all(updates)

      // Log settings change
      await prisma.adminLog.create({
        data: {
          adminId,
          action: 'Platform settings updated',
          entityType: 'SYSTEM',
          entityId: 'platform_settings',
          details: body
        }
      })

      // Clear relevant caches
      await cacheService.invalidatePattern('settings:*')

      return reply.send({
        message: 'Configurações atualizadas com sucesso!'
      })

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Dados inválidos',
          details: error.errors
        })
      }

      request.log.error('Update platform settings error:', error)
      return reply.status(500).send({
        error: 'Erro interno'
      })
    }
  }

  // System monitoring
  async getSystemHealth(request: FastifyRequest, reply: FastifyReply) {
    try {
      const health = await this.getSystemHealth()
      
      return reply.send(health)

    } catch (error) {
      request.log.error('System health error:', error)
      return reply.status(500).send({
        error: 'Erro interno'
      })
    }
  }

  // Helper methods
  private calculateDateRange(period: string): { startDate: Date, endDate: Date } {
    const endDate = new Date()
    const startDate = new Date()

    switch (period) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7)
        break
      case '30d':
        startDate.setDate(endDate.getDate() - 30)
        break
      case '90d':
        startDate.setDate(endDate.getDate() - 90)
        break
      case '1y':
        startDate.setFullYear(endDate.getFullYear() - 1)
        break
      case 'all':
        startDate.setFullYear(2020)
        break
      default:
        startDate.setDate(endDate.getDate() - 30)
    }

    return { startDate, endDate }
  }

  private buildUserOrderBy(sortBy: string): any {
    switch (sortBy) {
      case 'oldest':
        return { createdAt: 'asc' }
      case 'name':
        return { name: 'asc' }
      case 'email':
        return { email: 'asc' }
      case 'lastLogin':
        return { lastLoginAt: 'desc' }
      case 'newest':
      default:
        return { createdAt: 'desc' }
    }
  }

  private async getUserStats(startDate: Date, endDate: Date): Promise<any> {
    const [totalUsers, newUsers, activeUsers, hosts] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({
        where: { createdAt: { gte: startDate, lte: endDate } }
      }),
      prisma.user.count({
        where: { 
          lastLoginAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          status: 'ACTIVE'
        }
      }),
      prisma.user.count({ where: { role: 'HOST' } })
    ])

    return { totalUsers, newUsers, activeUsers, hosts }
  }

  private async getPropertyStats(startDate: Date, endDate: Date): Promise<any> {
    const [totalProperties, newProperties, activeProperties, pendingReview] = await Promise.all([
      prisma.property.count(),
      prisma.property.count({
        where: { createdAt: { gte: startDate, lte: endDate } }
      }),
      prisma.property.count({ where: { status: 'ACTIVE' } }),
      prisma.property.count({ where: { status: { in: ['DRAFT', 'UNDER_REVIEW'] } } })
    ])

    return { totalProperties, newProperties, activeProperties, pendingReview }
  }

  private async getBookingStats(startDate: Date, endDate: Date): Promise<any> {
    const [totalBookings, newBookings, completedBookings, cancelledBookings] = await Promise.all([
      prisma.booking.count(),
      prisma.booking.count({
        where: { createdAt: { gte: startDate, lte: endDate } }
      }),
      prisma.booking.count({
        where: { 
          status: 'COMPLETED',
          createdAt: { gte: startDate, lte: endDate }
        }
      }),
      prisma.booking.count({
        where: { 
          status: 'CANCELLED',
          createdAt: { gte: startDate, lte: endDate }
        }
      })
    ])

    return { totalBookings, newBookings, completedBookings, cancelledBookings }
  }

  private async getRevenueStats(startDate: Date, endDate: Date): Promise<any> {
    const revenue = await prisma.payment.aggregate({
      _sum: { amount: true },
      _count: { id: true },
      where: {
        status: 'COMPLETED',
        createdAt: { gte: startDate, lte: endDate }
      }
    })

    return {
      totalRevenue: revenue._sum.amount || 0,
      totalTransactions: revenue._count
    }
  }

  private async getPendingApprovals(): Promise<any> {
    const [properties, hosts, disputes, reports] = await Promise.all([
      prisma.property.count({ where: { status: { in: ['DRAFT', 'UNDER_REVIEW'] } } }),
      prisma.user.count({ 
        where: { 
          role: 'HOST',
          hostProfile: { identityVerified: false }
        }
      }),
      prisma.dispute.count({ where: { status: 'PENDING' } }),
      prisma.report.count({ where: { status: 'PENDING' } })
    ])

    return { properties, hosts, disputes, reports }
  }

  private async getRecentActivity(limit: number): Promise<any[]> {
    return await prisma.adminLog.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        admin: {
          select: { name: true, email: true }
        }
      }
    })
  }

  private async getSystemHealth(): Promise<any> {
    try {
      // Database health
      const dbStart = Date.now()
      await prisma.$queryRaw`SELECT 1`
      const dbLatency = Date.now() - dbStart

      // Cache health
      const cacheStart = Date.now()
      await cacheService.get('health_check')
      const cacheLatency = Date.now() - cacheStart

      // Calculate overall health
      const dbHealthy = dbLatency < 100
      const cacheHealthy = cacheLatency < 50

      return {
        overall: (dbHealthy && cacheHealthy) ? 'healthy' : 'degraded',
        database: {
          status: dbHealthy ? 'healthy' : 'slow',
          latency: dbLatency
        },
        cache: {
          status: cacheHealthy ? 'healthy' : 'slow',
          latency: cacheLatency
        },
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date()
      }
    } catch (error) {
      return {
        overall: 'unhealthy',
        error: error.message,
        timestamp: new Date()
      }
    }
  }

  private async getTotalRevenue(startDate: Date, endDate: Date): Promise<number> {
    const result = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        status: 'COMPLETED',
        createdAt: { gte: startDate, lte: endDate }
      }
    })
    return result._sum.amount || 0
  }

  private async getPlatformCommission(startDate: Date, endDate: Date): Promise<number> {
    // Assuming 10% commission rate
    const totalRevenue = await this.getTotalRevenue(startDate, endDate)
    return totalRevenue * 0.1
  }

  private async getPayoutsPending(): Promise<number> {
    const result = await prisma.payout.aggregate({
      _sum: { amount: true },
      where: { status: 'PENDING' }
    })
    return result._sum.amount || 0
  }

  private async getPayoutsCompleted(startDate: Date, endDate: Date): Promise<number> {
    const result = await prisma.payout.aggregate({
      _sum: { amount: true },
      where: {
        status: 'COMPLETED',
        createdAt: { gte: startDate, lte: endDate }
      }
    })
    return result._sum.amount || 0
  }

  private async getTransactionVolume(startDate: Date, endDate: Date): Promise<any> {
    return await prisma.payment.aggregate({
      _count: { id: true },
      _sum: { amount: true },
      where: {
        createdAt: { gte: startDate, lte: endDate }
      }
    })
  }

  private async getTopEarningHosts(startDate: Date, endDate: Date, limit: number): Promise<any[]> {
    return await prisma.user.findMany({
      where: {
        role: 'HOST',
        payments: {
          some: {
            status: 'COMPLETED',
            createdAt: { gte: startDate, lte: endDate }
          }
        }
      },
      include: {
        hostProfile: true,
        payments: {
          where: {
            status: 'COMPLETED',
            createdAt: { gte: startDate, lte: endDate }
          }
        }
      },
      take: limit
    })
  }

  private async getRevenueTrends(startDate: Date, endDate: Date): Promise<any[]> {
    // Simplified revenue trends - would implement proper date grouping in production
    return []
  }

  private getUserModerationMessage(action: string, reason: string): { subject: string, html: string } {
    const baseHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>🏠 HospedeFácil - Atualização da Conta</h2>
        <p>Sua conta foi atualizada pela nossa equipe de moderação.</p>
        <p><strong>Motivo:</strong> ${reason}</p>
        <p>Se você tiver dúvidas, entre em contato conosco.</p>
      </div>
    `

    const messages = {
      VERIFY: {
        subject: '✅ Conta verificada - HospedeFácil',
        html: baseHtml.replace('atualizada', 'verificada')
      },
      SUSPEND: {
        subject: '⚠️ Conta suspensa - HospedeFácil',
        html: baseHtml.replace('atualizada', 'suspensa')
      },
      BAN: {
        subject: '🚫 Conta banida - HospedeFácil',
        html: baseHtml.replace('atualizada', 'banida')
      },
      ACTIVATE: {
        subject: '✅ Conta reativada - HospedeFácil',
        html: baseHtml.replace('atualizada', 'reativada')
      },
      MAKE_HOST: {
        subject: '🏠 Você agora é um anfitrião - HospedeFácil',
        html: baseHtml.replace('atualizada', 'promovida para anfitrião')
      },
      REVOKE_HOST: {
        subject: '⚠️ Privilégios de anfitrião removidos - HospedeFácil',
        html: baseHtml.replace('atualizada', 'rebaixada')
      }
    }

    return messages[action as keyof typeof messages] || messages.VERIFY
  }

  private getPropertyModerationMessage(action: string, reason: string, propertyTitle: string): { subject: string, html: string } {
    const baseHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>🏠 HospedeFácil - Atualização da Propriedade</h2>
        <p>Sua propriedade <strong>"${propertyTitle}"</strong> foi moderada.</p>
        <p><strong>Motivo:</strong> ${reason}</p>
        <p>Para mais informações, acesse seu painel do anfitrião.</p>
      </div>
    `

    const messages = {
      APPROVE: {
        subject: `✅ Propriedade aprovada - ${propertyTitle}`,
        html: baseHtml.replace('moderada', 'aprovada')
      },
      REJECT: {
        subject: `❌ Propriedade rejeitada - ${propertyTitle}`,
        html: baseHtml.replace('moderada', 'rejeitada')
      },
      SUSPEND: {
        subject: `⚠️ Propriedade suspensa - ${propertyTitle}`,
        html: baseHtml.replace('moderada', 'suspensa')
      },
      REQUEST_CHANGES: {
        subject: `📝 Mudanças solicitadas - ${propertyTitle}`,
        html: baseHtml.replace('moderada', 'revisada - mudanças necessárias')
      }
    }

    return messages[action as keyof typeof messages] || messages.APPROVE
  }
}
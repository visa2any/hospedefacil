import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { prisma } from '@/config/database.js'
import { cacheService } from '@/config/redis.js'
import { AIService } from '@/services/ai.js'

// Validation schemas
const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  period: z.enum(['7d', '30d', '90d', '1y', 'all']).default('30d')
})

const propertyAnalyticsSchema = z.object({
  propertyId: z.string().min(1),
  ...dateRangeSchema.shape
})

export class DashboardController {
  private aiService = new AIService()

  // Host Dashboard - Main Overview
  async getHostDashboard(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = dateRangeSchema.parse(request.query)
      const hostId = request.user!.id

      // Verify host permissions
      const hostProfile = await prisma.hostProfile.findUnique({
        where: { userId: hostId }
      })

      if (!hostProfile) {
        return reply.status(403).send({
          error: 'Acesso negado',
          message: 'Você precisa ser um anfitrião para acessar este dashboard.'
        })
      }

      // Calculate date range
      const { startDate, endDate } = this.calculateDateRange(query.period)

      // Get dashboard metrics in parallel
      const [
        properties,
        bookingsOverview,
        revenueMetrics,
        upcomingBookings,
        recentReviews,
        occupancyData,
        topPerformingProperties
      ] = await Promise.all([
        this.getHostProperties(hostId),
        this.getBookingsOverview(hostId, startDate, endDate),
        this.getRevenueMetrics(hostId, startDate, endDate),
        this.getUpcomingBookings(hostId),
        this.getRecentReviews(hostId, 5),
        this.getOccupancyData(hostId, startDate, endDate),
        this.getTopPerformingProperties(hostId, startDate, endDate)
      ])

      // Get AI insights
      const aiInsights = await this.generateHostInsights(hostId, {
        properties: properties.length,
        totalRevenue: revenueMetrics.totalRevenue,
        bookings: bookingsOverview.totalBookings,
        averageRating: revenueMetrics.averageRating,
        occupancyRate: occupancyData.averageOccupancy
      })

      return reply.send({
        period: query.period,
        overview: {
          totalProperties: properties.length,
          activeProperties: properties.filter(p => p.status === 'ACTIVE').length,
          draftProperties: properties.filter(p => p.status === 'DRAFT').length,
          totalBookings: bookingsOverview.totalBookings,
          confirmedBookings: bookingsOverview.confirmedBookings,
          pendingBookings: bookingsOverview.pendingBookings,
          totalRevenue: revenueMetrics.totalRevenue,
          expectedRevenue: revenueMetrics.expectedRevenue,
          averageRating: revenueMetrics.averageRating,
          totalReviews: revenueMetrics.totalReviews,
          occupancyRate: occupancyData.averageOccupancy,
          responseRate: hostProfile.responseRate,
          responseTime: hostProfile.responseTime,
          isSuperHost: hostProfile.isSuperHost
        },
        revenue: {
          ...revenueMetrics,
          monthlyTrend: await this.getMonthlyRevenueTrend(hostId, 12),
          payoutSchedule: await this.getPayoutSchedule(hostId)
        },
        bookings: {
          ...bookingsOverview,
          upcoming: upcomingBookings,
          weeklyTrend: await this.getWeeklyBookingTrend(hostId, 12)
        },
        properties: {
          list: properties,
          topPerforming: topPerformingProperties,
          occupancyData
        },
        reviews: {
          recent: recentReviews,
          summary: await this.getReviewsSummary(hostId)
        },
        insights: aiInsights,
        quickActions: [
          { id: 'add_property', title: 'Adicionar propriedade', icon: '➕' },
          { id: 'update_calendar', title: 'Atualizar disponibilidade', icon: '📅' },
          { id: 'review_prices', title: 'Revisar preços', icon: '💰' },
          { id: 'respond_messages', title: 'Responder mensagens', icon: '💬' },
          { id: 'check_analytics', title: 'Ver analytics detalhado', icon: '📊' }
        ]
      })

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Parâmetros inválidos',
          details: error.errors
        })
      }

      request.log.error('Host dashboard error:', error)
      return reply.status(500).send({
        error: 'Erro interno',
        message: 'Não foi possível carregar o dashboard.'
      })
    }
  }

  // Guest Dashboard - Main Overview
  async getGuestDashboard(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = dateRangeSchema.parse(request.query)
      const guestId = request.user!.id

      // Calculate date range
      const { startDate, endDate } = this.calculateDateRange(query.period)

      // Get dashboard data in parallel
      const [
        bookingsOverview,
        upcomingTrips,
        pastTrips,
        favoriteProperties,
        paymentHistory,
        reviewsToWrite,
        travelStats,
        recommendations
      ] = await Promise.all([
        this.getGuestBookingsOverview(guestId, startDate, endDate),
        this.getUpcomingTrips(guestId),
        this.getPastTrips(guestId, 5),
        this.getFavoriteProperties(guestId, 10),
        this.getPaymentHistory(guestId, 10),
        this.getReviewsToWrite(guestId),
        this.getTravelStats(guestId),
        this.getPersonalizedRecommendations(guestId, 6)
      ])

      return reply.send({
        period: query.period,
        overview: {
          totalTrips: travelStats.totalTrips,
          upcomingTrips: upcomingTrips.length,
          totalSpent: travelStats.totalSpent,
          favoriteDestinations: travelStats.favoriteDestinations,
          averageRating: travelStats.averageRating,
          totalReviews: travelStats.totalReviews,
          savedProperties: favoriteProperties.length,
          loyaltyPoints: travelStats.loyaltyPoints || 0
        },
        trips: {
          upcoming: upcomingTrips,
          past: pastTrips,
          statistics: travelStats,
          bookingsOverview
        },
        favorites: favoriteProperties,
        payments: paymentHistory,
        reviews: {
          toWrite: reviewsToWrite,
          written: travelStats.totalReviews
        },
        recommendations: recommendations,
        quickActions: [
          { id: 'search_properties', title: 'Buscar hospedagem', icon: '🔍' },
          { id: 'view_trips', title: 'Minhas viagens', icon: '✈️' },
          { id: 'write_reviews', title: 'Escrever avaliações', icon: '⭐' },
          { id: 'manage_favorites', title: 'Propriedades salvas', icon: '❤️' },
          { id: 'payment_methods', title: 'Formas de pagamento', icon: '💳' }
        ],
        notifications: await this.getGuestNotifications(guestId, 5)
      })

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Parâmetros inválidos',
          details: error.errors
        })
      }

      request.log.error('Guest dashboard error:', error)
      return reply.status(500).send({
        error: 'Erro interno',
        message: 'Não foi possível carregar o dashboard.'
      })
    }
  }

  // Detailed Property Analytics (Host only)
  async getPropertyAnalytics(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = propertyAnalyticsSchema.parse(request.query)
      const hostId = request.user!.id

      // Verify property ownership
      const property = await prisma.property.findFirst({
        where: {
          id: query.propertyId,
          hostId: hostId
        },
        include: {
          images: { take: 1 },
          _count: {
            select: {
              bookings: true,
              reviews: true
            }
          }
        }
      })

      if (!property) {
        return reply.status(404).send({
          error: 'Propriedade não encontrada'
        })
      }

      const { startDate, endDate } = this.calculateDateRange(query.period)

      // Get detailed analytics
      const [
        bookingAnalytics,
        revenueAnalytics,
        occupancyAnalytics,
        reviewAnalytics,
        competitorAnalysis,
        pricingInsights
      ] = await Promise.all([
        this.getPropertyBookingAnalytics(query.propertyId, startDate, endDate),
        this.getPropertyRevenueAnalytics(query.propertyId, startDate, endDate),
        this.getPropertyOccupancyAnalytics(query.propertyId, startDate, endDate),
        this.getPropertyReviewAnalytics(query.propertyId),
        this.getCompetitorAnalysis(property.city, property.type, property.bedrooms),
        this.getPricingInsights(query.propertyId, startDate, endDate)
      ])

      // Generate AI recommendations
      const aiRecommendations = await this.generatePropertyRecommendations(property, {
        bookingAnalytics,
        revenueAnalytics,
        occupancyAnalytics,
        reviewAnalytics,
        competitorAnalysis
      })

      return reply.send({
        property: {
          id: property.id,
          title: property.title,
          type: property.type,
          city: property.city,
          bedrooms: property.bedrooms,
          maxGuests: property.maxGuests,
          basePrice: property.basePrice,
          status: property.status,
          image: property.images[0]?.url
        },
        period: query.period,
        analytics: {
          bookings: bookingAnalytics,
          revenue: revenueAnalytics,
          occupancy: occupancyAnalytics,
          reviews: reviewAnalytics,
          pricing: pricingInsights
        },
        benchmarks: {
          competitor: competitorAnalysis,
          market: await this.getMarketBenchmarks(property.city, property.type)
        },
        recommendations: aiRecommendations,
        trends: {
          booking: await this.getBookingTrends(query.propertyId, 12),
          pricing: await this.getPricingTrends(query.propertyId, 12),
          occupancy: await this.getOccupancyTrends(query.propertyId, 12)
        }
      })

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Parâmetros inválidos',
          details: error.errors
        })
      }

      request.log.error('Property analytics error:', error)
      return reply.status(500).send({
        error: 'Erro interno',
        message: 'Não foi possível carregar as analytics da propriedade.'
      })
    }
  }

  // Revenue Analytics (Host only)
  async getRevenueAnalytics(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = dateRangeSchema.parse(request.query)
      const hostId = request.user!.id

      const { startDate, endDate } = this.calculateDateRange(query.period)

      const [
        revenueByProperty,
        revenueByMonth,
        payoutHistory,
        taxSummary,
        projectedRevenue
      ] = await Promise.all([
        this.getRevenueByProperty(hostId, startDate, endDate),
        this.getRevenueByMonth(hostId, startDate, endDate),
        this.getPayoutHistory(hostId, startDate, endDate),
        this.getTaxSummary(hostId, startDate, endDate),
        this.getProjectedRevenue(hostId)
      ])

      return reply.send({
        period: query.period,
        summary: {
          totalRevenue: revenueByProperty.reduce((sum, p) => sum + p.revenue, 0),
          totalBookings: revenueByProperty.reduce((sum, p) => sum + p.bookings, 0),
          averageBookingValue: revenueByProperty.length > 0 
            ? revenueByProperty.reduce((sum, p) => sum + p.revenue, 0) / revenueByProperty.reduce((sum, p) => sum + p.bookings, 0)
            : 0,
          projectedRevenue: projectedRevenue.next30Days
        },
        breakdown: {
          byProperty: revenueByProperty,
          byMonth: revenueByMonth,
          byBookingSource: await this.getRevenueBySource(hostId, startDate, endDate)
        },
        payouts: payoutHistory,
        taxes: taxSummary,
        projections: projectedRevenue
      })

    } catch (error) {
      request.log.error('Revenue analytics error:', error)
      return reply.status(500).send({
        error: 'Erro interno'
      })
    }
  }

  // Helper Methods

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
        startDate.setFullYear(2020) // Platform start
        break
      default:
        startDate.setDate(endDate.getDate() - 30)
    }

    return { startDate, endDate }
  }

  private async getHostProperties(hostId: string): Promise<any[]> {
    return await prisma.property.findMany({
      where: { hostId },
      select: {
        id: true,
        title: true,
        status: true,
        city: true,
        state: true,
        basePrice: true,
        averageRating: true,
        reviewCount: true,
        totalBookings: true,
        totalEarnings: true,
        images: { take: 1, select: { url: true } }
      },
      orderBy: { totalEarnings: 'desc' }
    })
  }

  private async getBookingsOverview(hostId: string, startDate: Date, endDate: Date): Promise<any> {
    const bookings = await prisma.booking.groupBy({
      by: ['status'],
      _count: { id: true },
      where: {
        property: { hostId },
        createdAt: { gte: startDate, lte: endDate }
      }
    })

    const result = {
      totalBookings: 0,
      confirmedBookings: 0,
      pendingBookings: 0,
      cancelledBookings: 0,
      completedBookings: 0
    }

    bookings.forEach(booking => {
      result.totalBookings += booking._count.id
      switch (booking.status) {
        case 'CONFIRMED':
          result.confirmedBookings = booking._count.id
          break
        case 'PENDING':
          result.pendingBookings = booking._count.id
          break
        case 'CANCELLED':
          result.cancelledBookings = booking._count.id
          break
        case 'COMPLETED':
          result.completedBookings = booking._count.id
          break
      }
    })

    return result
  }

  private async getRevenueMetrics(hostId: string, startDate: Date, endDate: Date): Promise<any> {
    const revenueData = await prisma.payment.aggregate({
      _sum: { amount: true },
      _count: { id: true },
      where: {
        booking: {
          property: { hostId },
          createdAt: { gte: startDate, lte: endDate }
        },
        status: 'COMPLETED'
      }
    })

    const hostProfile = await prisma.hostProfile.findUnique({
      where: { userId: hostId },
      select: { 
        totalEarnings: true,
        averageRating: true,
        totalBookings: true 
      }
    })

    const reviewCount = await prisma.review.count({
      where: {
        property: { hostId },
        createdAt: { gte: startDate, lte: endDate }
      }
    })

    return {
      totalRevenue: revenueData._sum.amount || 0,
      totalPayments: revenueData._count,
      expectedRevenue: await this.calculateExpectedRevenue(hostId),
      averageRating: hostProfile?.averageRating || 0,
      totalReviews: reviewCount,
      allTimeEarnings: hostProfile?.totalEarnings || 0
    }
  }

  private async getUpcomingBookings(hostId: string): Promise<any[]> {
    const today = new Date()
    const thirtyDaysFromNow = new Date()
    thirtyDaysFromNow.setDate(today.getDate() + 30)

    return await prisma.booking.findMany({
      where: {
        property: { hostId },
        checkIn: { gte: today, lte: thirtyDaysFromNow },
        status: { in: ['CONFIRMED', 'PENDING'] }
      },
      select: {
        id: true,
        checkIn: true,
        checkOut: true,
        nights: true,
        guests: true,
        totalPrice: true,
        status: true,
        guestName: true,
        guestEmail: true,
        property: {
          select: { title: true, city: true }
        }
      },
      orderBy: { checkIn: 'asc' },
      take: 10
    })
  }

  private async generateHostInsights(hostId: string, metrics: any): Promise<string[]> {
    if (!this.aiService.getStatus().isReady) {
      return [
        'Configure a IA para receber insights personalizados',
        'Suas propriedades estão performando bem!',
        'Continue mantendo a qualidade do atendimento'
      ]
    }

    try {
      const insight = await this.aiService.generatePricingRecommendation(
        { hostId, ...metrics },
        { averageOccupancy: metrics.occupancyRate }
      )

      if (insight) {
        return insight.split('.').filter(s => s.trim().length > 0).slice(0, 3)
      }
    } catch (error) {
      console.error('Error generating host insights:', error)
    }

    return [
      'Suas propriedades estão performando bem!',
      'Continue mantendo a qualidade do atendimento',
      'Considere ajustar preços baseado na demanda'
    ]
  }

  private async calculateExpectedRevenue(hostId: string): Promise<number> {
    // Calculate expected revenue from confirmed bookings
    const confirmedBookings = await prisma.booking.aggregate({
      _sum: { totalPrice: true },
      where: {
        property: { hostId },
        status: 'CONFIRMED',
        checkIn: { gte: new Date() }
      }
    })

    return confirmedBookings._sum.totalPrice || 0
  }

  // Occupancy Analytics
  private async getOccupancyData(hostId: string, startDate: Date, endDate: Date): Promise<any> {
    const properties = await prisma.property.findMany({
      where: { hostId, status: 'ACTIVE' },
      select: { id: true }
    })

    if (properties.length === 0) {
      return { averageOccupancy: 0, propertiesData: [] }
    }

    const propertyIds = properties.map(p => p.id)
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))

    // Get booked nights for each property
    const bookings = await prisma.booking.findMany({
      where: {
        propertyId: { in: propertyIds },
        status: { in: ['CONFIRMED', 'COMPLETED', 'IN_PROGRESS'] },
        OR: [
          {
            AND: [
              { checkIn: { lte: endDate } },
              { checkOut: { gt: startDate } }
            ]
          }
        ]
      },
      select: {
        propertyId: true,
        checkIn: true,
        checkOut: true,
        nights: true
      }
    })

    // Calculate occupancy per property
    const propertiesData = properties.map(property => {
      const propertyBookings = bookings.filter(b => b.propertyId === property.id)
      const bookedNights = propertyBookings.reduce((sum, booking) => {
        // Calculate overlap with date range
        const bookingStart = booking.checkIn > startDate ? booking.checkIn : startDate
        const bookingEnd = booking.checkOut < endDate ? booking.checkOut : endDate
        const overlapNights = Math.max(0, Math.ceil((bookingEnd.getTime() - bookingStart.getTime()) / (1000 * 60 * 60 * 24)))
        return sum + overlapNights
      }, 0)

      const occupancyRate = totalDays > 0 ? (bookedNights / totalDays) * 100 : 0

      return {
        propertyId: property.id,
        totalDays,
        bookedNights,
        occupancyRate: Math.round(occupancyRate * 100) / 100
      }
    })

    const averageOccupancy = propertiesData.reduce((sum, p) => sum + p.occupancyRate, 0) / propertiesData.length

    return {
      averageOccupancy: Math.round(averageOccupancy * 100) / 100,
      propertiesData
    }
  }

  private async getTopPerformingProperties(hostId: string, startDate: Date, endDate: Date): Promise<any[]> {
    return await prisma.property.findMany({
      where: {
        hostId,
        status: 'ACTIVE'
      },
      select: {
        id: true,
        title: true,
        city: true,
        state: true,
        basePrice: true,
        averageRating: true,
        reviewCount: true,
        totalEarnings: true,
        totalBookings: true,
        images: {
          take: 1,
          select: { url: true }
        },
        _count: {
          select: {
            bookings: {
              where: {
                createdAt: { gte: startDate, lte: endDate },
                status: { in: ['CONFIRMED', 'COMPLETED'] }
              }
            }
          }
        }
      },
      orderBy: [
        { totalEarnings: 'desc' },
        { averageRating: 'desc' }
      ],
      take: 5
    })
  }

  private async getRecentReviews(hostId: string, limit: number): Promise<any[]> {
    return await prisma.review.findMany({
      where: { 
        property: { hostId },
        isPublic: true
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
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
            city: true
          } 
        },
        responses: {
          include: {
            author: {
              select: {
                name: true,
                avatar: true
              }
            }
          }
        }
      }
    })
  }

  private async getMonthlyRevenueTrend(hostId: string, months: number): Promise<any[]> {
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - months)
    
    const bookings = await prisma.booking.findMany({
      where: {
        property: { hostId },
        status: 'COMPLETED',
        createdAt: { gte: startDate }
      },
      include: {
        payments: {
          where: { status: 'COMPLETED' }
        }
      }
    })

    // Group by month
    const monthlyData: Record<string, { revenue: number, bookings: number }> = {}
    
    bookings.forEach(booking => {
      const monthKey = booking.createdAt.toISOString().substring(0, 7) // YYYY-MM
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { revenue: 0, bookings: 0 }
      }
      
      const revenue = booking.payments.reduce((sum, payment) => sum + payment.amount, 0)
      monthlyData[monthKey].revenue += revenue
      monthlyData[monthKey].bookings += 1
    })

    // Fill missing months and sort
    const result = []
    for (let i = months - 1; i >= 0; i--) {
      const date = new Date()
      date.setMonth(date.getMonth() - i)
      const monthKey = date.toISOString().substring(0, 7)
      
      result.push({
        month: monthKey,
        monthName: date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
        revenue: monthlyData[monthKey]?.revenue || 0,
        bookings: monthlyData[monthKey]?.bookings || 0
      })
    }

    return result
  }

  private async getPayoutSchedule(hostId: string): Promise<any[]> {
    // Get upcoming payouts (confirmed bookings that will generate payouts)
    const upcomingBookings = await prisma.booking.findMany({
      where: {
        property: { hostId },
        status: { in: ['CONFIRMED', 'IN_PROGRESS'] },
        checkOut: { gte: new Date() }
      },
      select: {
        id: true,
        checkOut: true,
        totalPrice: true,
        property: {
          select: {
            title: true
          }
        }
      },
      orderBy: { checkOut: 'asc' },
      take: 10
    })

    return upcomingBookings.map(booking => {
      const payoutDate = new Date(booking.checkOut)
      payoutDate.setDate(payoutDate.getDate() + 1) // Next day after checkout
      
      return {
        bookingId: booking.id,
        propertyTitle: booking.property.title,
        amount: booking.totalPrice * 0.85, // Assuming 15% platform fee
        scheduledDate: payoutDate,
        status: 'scheduled'
      }
    })
  }

  private async getWeeklyBookingTrend(hostId: string, weeks: number): Promise<any[]> {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - (weeks * 7))
    
    const bookings = await prisma.booking.findMany({
      where: {
        property: { hostId },
        createdAt: { gte: startDate }
      },
      select: {
        createdAt: true,
        status: true,
        totalPrice: true
      }
    })

    // Group by week
    const weeklyData: Record<string, { bookings: number, revenue: number }> = {}
    
    bookings.forEach(booking => {
      const weekStart = new Date(booking.createdAt)
      const dayOfWeek = weekStart.getDay()
      weekStart.setDate(weekStart.getDate() - dayOfWeek) // Start of week (Sunday)
      const weekKey = weekStart.toISOString().substring(0, 10) // YYYY-MM-DD
      
      if (!weeklyData[weekKey]) {
        weeklyData[weekKey] = { bookings: 0, revenue: 0 }
      }
      
      weeklyData[weekKey].bookings += 1
      if (booking.status === 'COMPLETED') {
        weeklyData[weekKey].revenue += booking.totalPrice
      }
    })

    // Fill missing weeks and sort
    const result = []
    for (let i = weeks - 1; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - (i * 7))
      const dayOfWeek = date.getDay()
      date.setDate(date.getDate() - dayOfWeek)
      const weekKey = date.toISOString().substring(0, 10)
      
      result.push({
        week: weekKey,
        weekStart: date.toLocaleDateString('pt-BR'),
        bookings: weeklyData[weekKey]?.bookings || 0,
        revenue: weeklyData[weekKey]?.revenue || 0
      })
    }

    return result
  }

  private async getReviewsSummary(hostId: string): Promise<any> {
    const [reviewStats, ratingDistribution] = await Promise.all([
      prisma.review.aggregate({
        where: {
          property: { hostId },
          isPublic: true
        },
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
      }),
      prisma.review.groupBy({
        by: ['rating'],
        where: {
          property: { hostId },
          isPublic: true
        },
        _count: { id: true }
      })
    ])

    // Format rating distribution
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    ratingDistribution.forEach(item => {
      distribution[item.rating as keyof typeof distribution] = item._count.id
    })

    return {
      averageRating: reviewStats._avg.rating || 0,
      totalReviews: reviewStats._count,
      detailedRatings: {
        cleanliness: reviewStats._avg.cleanliness || 0,
        accuracy: reviewStats._avg.accuracy || 0,
        checkIn: reviewStats._avg.checkIn || 0,
        communication: reviewStats._avg.communication || 0,
        location: reviewStats._avg.location || 0,
        value: reviewStats._avg.value || 0
      },
      ratingDistribution: distribution
    }
  }

  // Guest dashboard helper methods
  private async getGuestBookingsOverview(guestId: string, startDate: Date, endDate: Date): Promise<any> {
    const bookings = await prisma.booking.groupBy({
      by: ['status'],
      _count: { id: true },
      _sum: { totalPrice: true },
      where: {
        guestId,
        createdAt: { gte: startDate, lte: endDate }
      }
    })

    const result = {
      totalBookings: 0,
      confirmedBookings: 0,
      completedBookings: 0,
      cancelledBookings: 0,
      totalSpent: 0,
      averageBookingValue: 0
    }

    bookings.forEach(booking => {
      result.totalBookings += booking._count.id
      result.totalSpent += booking._sum.totalPrice || 0
      
      switch (booking.status) {
        case 'CONFIRMED':
          result.confirmedBookings = booking._count.id
          break
        case 'COMPLETED':
          result.completedBookings = booking._count.id
          break
        case 'CANCELLED':
          result.cancelledBookings = booking._count.id
          break
      }
    })

    result.averageBookingValue = result.totalBookings > 0 ? result.totalSpent / result.totalBookings : 0

    return result
  }

  private async getUpcomingTrips(guestId: string): Promise<any[]> {
    const today = new Date()
    
    return await prisma.booking.findMany({
      where: {
        guestId,
        checkIn: { gte: today },
        status: { in: ['CONFIRMED', 'PENDING'] }
      },
      select: {
        id: true,
        checkIn: true,
        checkOut: true,
        nights: true,
        guests: true,
        totalPrice: true,
        status: true,
        property: {
          select: {
            id: true,
            title: true,
            city: true,
            state: true,
            images: { take: 1, select: { url: true } },
            averageRating: true,
            host: {
              select: { name: true, avatar: true }
            }
          }
        }
      },
      orderBy: { checkIn: 'asc' },
      take: 10
    })
  }

  private async getPastTrips(guestId: string, limit: number): Promise<any[]> {
    const today = new Date()
    
    return await prisma.booking.findMany({
      where: {
        guestId,
        checkOut: { lt: today },
        status: 'COMPLETED'
      },
      select: {
        id: true,
        checkIn: true,
        checkOut: true,
        nights: true,
        guests: true,
        totalPrice: true,
        status: true,
        property: {
          select: {
            id: true,
            title: true,
            city: true,
            state: true,
            images: { take: 1, select: { url: true } },
            averageRating: true,
            host: {
              select: { name: true, avatar: true }
            }
          }
        },
        reviews: {
          where: { authorId: guestId },
          select: { id: true, rating: true }
        }
      },
      orderBy: { checkOut: 'desc' },
      take: limit
    })
  }

  private async getFavoriteProperties(guestId: string, limit: number): Promise<any[]> {
    return await prisma.savedProperty.findMany({
      where: { userId: guestId },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        property: {
          select: {
            id: true,
            title: true,
            city: true,
            state: true,
            type: true,
            basePrice: true,
            averageRating: true,
            reviewCount: true,
            images: { take: 1, select: { url: true, alt: true } },
            amenities: { take: 3, select: { name: true, icon: true } },
            host: {
              select: {
                name: true,
                avatar: true,
                hostProfile: {
                  select: { isSuperHost: true }
                }
              }
            }
          }
        }
      }
    })
  }

  private async getPaymentHistory(guestId: string, limit: number): Promise<any[]> {
    return await prisma.payment.findMany({
      where: {
        booking: { guestId }
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        amount: true,
        method: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        transactionId: true,
        booking: {
          select: {
            id: true,
            checkIn: true,
            checkOut: true,
            property: {
              select: {
                title: true,
                city: true,
                images: { take: 1, select: { url: true } }
              }
            }
          }
        }
      }
    })
  }

  private async getReviewsToWrite(guestId: string): Promise<any[]> {
    const completedBookings = await prisma.booking.findMany({
      where: {
        guestId,
        status: 'COMPLETED',
        checkOut: { lt: new Date() },
        reviews: { none: { authorId: guestId } } // No review written yet
      },
      select: {
        id: true,
        checkIn: true,
        checkOut: true,
        property: {
          select: {
            id: true,
            title: true,
            city: true,
            images: { take: 1, select: { url: true } },
            host: {
              select: { name: true, avatar: true }
            }
          }
        }
      },
      orderBy: { checkOut: 'desc' },
      take: 10
    })

    return completedBookings
  }

  private async getTravelStats(guestId: string): Promise<any> {
    const [bookingStats, reviewStats, topDestinations, favoriteProperties] = await Promise.all([
      prisma.booking.aggregate({
        where: {
          guestId,
          status: 'COMPLETED'
        },
        _count: { id: true },
        _sum: { totalPrice: true }
      }),
      prisma.review.aggregate({
        where: {
          authorId: guestId,
          isPublic: true
        },
        _count: { id: true },
        _avg: { rating: true }
      }),
      prisma.booking.groupBy({
        by: ['property'],
        where: {
          guestId,
          status: 'COMPLETED'
        },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 3
      }),
      prisma.savedProperty.count({ where: { userId: guestId } })
    ])

    // Get city names for top destinations
    const destinations = await Promise.all(
      topDestinations.map(async (dest: any) => {
        const property = await prisma.property.findUnique({
          where: { id: dest.property },
          select: { city: true, state: true }
        })
        return {
          city: property?.city || 'Desconhecido',
          state: property?.state || '',
          trips: dest._count.id
        }
      })
    )

    return {
      totalTrips: bookingStats._count || 0,
      totalSpent: bookingStats._sum.totalPrice || 0,
      favoriteDestinations: destinations,
      averageRating: reviewStats._avg.rating || 0,
      totalReviews: reviewStats._count || 0,
      savedProperties: favoriteProperties,
      loyaltyPoints: Math.floor((bookingStats._sum.totalPrice || 0) / 100) // 1 point per R$100 spent
    }
  }

  private async getPersonalizedRecommendations(guestId: string, limit: number): Promise<any[]> {
    // Get guest preferences from past bookings
    const pastBookings = await prisma.booking.findMany({
      where: {
        guestId,
        status: 'COMPLETED'
      },
      select: {
        property: {
          select: {
            type: true,
            city: true,
            state: true,
            basePrice: true,
            bedrooms: true
          }
        }
      }
    })

    // Extract preferences
    const preferredTypes = new Set(pastBookings.map(b => b.property.type))
    const preferredStates = new Set(pastBookings.map(b => b.property.state))
    const avgPrice = pastBookings.length > 0 
      ? pastBookings.reduce((sum, b) => sum + b.property.basePrice, 0) / pastBookings.length
      : 500

    // Find similar properties
    return await prisma.property.findMany({
      where: {
        status: 'ACTIVE',
        type: preferredTypes.size > 0 ? { in: Array.from(preferredTypes) } : undefined,
        state: preferredStates.size > 0 ? { in: Array.from(preferredStates) } : undefined,
        basePrice: {
          gte: Math.max(avgPrice * 0.7, 50),
          lte: avgPrice * 1.3
        },
        bookings: {
          none: { guestId } // Not previously booked
        }
      },
      select: {
        id: true,
        title: true,
        city: true,
        state: true,
        type: true,
        basePrice: true,
        averageRating: true,
        reviewCount: true,
        images: { take: 1, select: { url: true, alt: true } },
        amenities: { take: 3, select: { name: true, icon: true } },
        host: {
          select: {
            name: true,
            hostProfile: {
              select: { isSuperHost: true }
            }
          }
        }
      },
      orderBy: [
        { averageRating: 'desc' },
        { reviewCount: 'desc' }
      ],
      take: limit
    })
  }

  private async getGuestNotifications(guestId: string, limit: number): Promise<any[]> {
    // Get upcoming check-ins (within 7 days)
    const upcomingBookings = await prisma.booking.findMany({
      where: {
        guestId,
        status: 'CONFIRMED',
        checkIn: {
          gte: new Date(),
          lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
      },
      select: {
        id: true,
        checkIn: true,
        property: { select: { title: true, city: true } }
      }
    })

    // Get pending reviews to write
    const reviewsToWrite = await this.getReviewsToWrite(guestId)

    const notifications: any[] = []

    // Add check-in reminders
    upcomingBookings.forEach(booking => {
      const daysUntil = Math.ceil((booking.checkIn.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      notifications.push({
        id: `checkin-${booking.id}`,
        type: 'checkin_reminder',
        title: `Check-in em ${daysUntil} dia${daysUntil > 1 ? 's' : ''}`,
        message: `Sua estadia em ${booking.property.title}, ${booking.property.city}`,
        createdAt: new Date(),
        priority: daysUntil <= 1 ? 'high' : 'medium',
        actionUrl: `/reservas/${booking.id}`
      })
    })

    // Add review reminders (limit to 3)
    reviewsToWrite.slice(0, 3).forEach(booking => {
      notifications.push({
        id: `review-${booking.id}`,
        type: 'review_reminder',
        title: 'Avalie sua estadia',
        message: `Como foi sua experiência em ${booking.property.title}?`,
        createdAt: booking.checkOut,
        priority: 'low',
        actionUrl: `/reviews/write/${booking.id}`
      })
    })

    return notifications
      .sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 }
        return priorityOrder[b.priority as keyof typeof priorityOrder] - priorityOrder[a.priority as keyof typeof priorityOrder]
      })
      .slice(0, limit)
  }

  // Property analytics helper methods
  private async getPropertyBookingAnalytics(propertyId: string, startDate: Date, endDate: Date): Promise<any> {
    const [bookingStats, conversionData, sourceData] = await Promise.all([
      prisma.booking.groupBy({
        by: ['status'],
        where: {
          propertyId,
          createdAt: { gte: startDate, lte: endDate }
        },
        _count: { id: true },
        _sum: { totalPrice: true, nights: true }
      }),
      prisma.booking.aggregate({
        where: {
          propertyId,
          createdAt: { gte: startDate, lte: endDate }
        },
        _count: { id: true },
        _avg: { nights: true, guests: true, totalPrice: true }
      }),
      prisma.booking.groupBy({
        by: ['source'],
        where: {
          propertyId,
          createdAt: { gte: startDate, lte: endDate }
        },
        _count: { id: true }
      })
    ])

    const statusBreakdown: any = {
      confirmed: 0,
      completed: 0,
      cancelled: 0,
      pending: 0
    }

    bookingStats.forEach(stat => {
      statusBreakdown[stat.status.toLowerCase()] = stat._count.id
    })

    return {
      totalBookings: conversionData._count,
      statusBreakdown,
      averageNights: conversionData._avg.nights || 0,
      averageGuests: conversionData._avg.guests || 0,
      averageBookingValue: conversionData._avg.totalPrice || 0,
      bookingsBySource: sourceData,
      cancellationRate: statusBreakdown.confirmed + statusBreakdown.completed > 0 
        ? (statusBreakdown.cancelled / (statusBreakdown.confirmed + statusBreakdown.completed + statusBreakdown.cancelled)) * 100 
        : 0
    }
  }

  private async getPropertyRevenueAnalytics(propertyId: string, startDate: Date, endDate: Date): Promise<any> {
    const [revenueData, monthlyRevenue] = await Promise.all([
      prisma.payment.aggregate({
        where: {
          booking: {
            propertyId,
            createdAt: { gte: startDate, lte: endDate }
          },
          status: 'COMPLETED'
        },
        _sum: { amount: true },
        _count: { id: true },
        _avg: { amount: true }
      }),
      prisma.payment.findMany({
        where: {
          booking: {
            propertyId,
            createdAt: { gte: startDate, lte: endDate }
          },
          status: 'COMPLETED'
        },
        select: {
          amount: true,
          createdAt: true
        }
      })
    ])

    // Group revenue by month
    const monthlyData: Record<string, number> = {}
    monthlyRevenue.forEach(payment => {
      const monthKey = payment.createdAt.toISOString().substring(0, 7)
      monthlyData[monthKey] = (monthlyData[monthKey] || 0) + payment.amount
    })

    return {
      totalRevenue: revenueData._sum.amount || 0,
      totalTransactions: revenueData._count,
      averageTransactionValue: revenueData._avg.amount || 0,
      monthlyBreakdown: monthlyData,
      hostEarnings: (revenueData._sum.amount || 0) * 0.9, // 90% to host
      platformFee: (revenueData._sum.amount || 0) * 0.1, // 10% platform fee
      projectedAnnualRevenue: Object.values(monthlyData).length > 0 
        ? (Object.values(monthlyData).reduce((sum, val) => sum + val, 0) / Object.values(monthlyData).length) * 12 
        : 0
    }
  }

  private async getPropertyOccupancyAnalytics(propertyId: string, startDate: Date, endDate: Date): Promise<any> {
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    
    const bookings = await prisma.booking.findMany({
      where: {
        propertyId,
        status: { in: ['CONFIRMED', 'COMPLETED', 'IN_PROGRESS'] },
        OR: [
          {
            AND: [
              { checkIn: { lte: endDate } },
              { checkOut: { gt: startDate } }
            ]
          }
        ]
      },
      select: {
        checkIn: true,
        checkOut: true,
        nights: true,
        guests: true
      }
    })

    // Calculate booked nights within the date range
    let bookedNights = 0
    let totalGuests = 0
    
    bookings.forEach(booking => {
      const bookingStart = booking.checkIn > startDate ? booking.checkIn : startDate
      const bookingEnd = booking.checkOut < endDate ? booking.checkOut : endDate
      const overlapNights = Math.max(0, Math.ceil((bookingEnd.getTime() - bookingStart.getTime()) / (1000 * 60 * 60 * 24)))
      
      bookedNights += overlapNights
      totalGuests += booking.guests * overlapNights
    })

    const occupancyRate = totalDays > 0 ? (bookedNights / totalDays) * 100 : 0
    const averageGuestsPerNight = bookedNights > 0 ? totalGuests / bookedNights : 0

    return {
      totalDays,
      bookedNights,
      availableNights: totalDays - bookedNights,
      occupancyRate: Math.round(occupancyRate * 100) / 100,
      averageGuestsPerNight: Math.round(averageGuestsPerNight * 100) / 100,
      totalBookings: bookings.length,
      averageStayLength: bookings.length > 0 
        ? bookings.reduce((sum, b) => sum + b.nights, 0) / bookings.length 
        : 0
    }
  }

  private async getPropertyReviewAnalytics(propertyId: string): Promise<any> {
    const [reviewStats, ratingDistribution, recentReviews, responseRate] = await Promise.all([
      prisma.review.aggregate({
        where: {
          propertyId,
          isPublic: true
        },
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
      }),
      prisma.review.groupBy({
        by: ['rating'],
        where: {
          propertyId,
          isPublic: true
        },
        _count: { id: true }
      }),
      prisma.review.findMany({
        where: {
          propertyId,
          isPublic: true
        },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          rating: true,
          content: true,
          createdAt: true,
          author: {
            select: { name: true, avatar: true }
          },
          responses: {
            select: { id: true }
          }
        }
      }),
      prisma.review.findMany({
        where: {
          propertyId,
          isPublic: true,
          responses: { some: {} }
        },
        select: { id: true }
      })
    ])

    // Format rating distribution
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    ratingDistribution.forEach(item => {
      distribution[item.rating as keyof typeof distribution] = item._count.id
    })

    const responseRatePercent = reviewStats._count > 0 
      ? (responseRate.length / reviewStats._count) * 100 
      : 0

    return {
      averageRating: reviewStats._avg.rating || 0,
      totalReviews: reviewStats._count,
      detailedRatings: {
        cleanliness: reviewStats._avg.cleanliness || 0,
        accuracy: reviewStats._avg.accuracy || 0,
        checkIn: reviewStats._avg.checkIn || 0,
        communication: reviewStats._avg.communication || 0,
        location: reviewStats._avg.location || 0,
        value: reviewStats._avg.value || 0
      },
      ratingDistribution: distribution,
      recentReviews,
      responseRate: Math.round(responseRatePercent * 100) / 100
    }
  }

  private async getCompetitorAnalysis(city: string, type: string, bedrooms: number): Promise<any> {
    // Find similar properties in the same city
    const similarProperties = await prisma.property.findMany({
      where: {
        city,
        type,
        bedrooms: { gte: bedrooms - 1, lte: bedrooms + 1 },
        status: 'ACTIVE'
      },
      select: {
        id: true,
        title: true,
        basePrice: true,
        averageRating: true,
        reviewCount: true,
        totalBookings: true,
        totalEarnings: true
      },
      take: 50
    })

    if (similarProperties.length === 0) {
      return {
        marketSize: 0,
        averagePrice: 0,
        averageRating: 0,
        averageBookings: 0,
        priceRange: { min: 0, max: 0 },
        competitivePosition: 'unknown'
      }
    }

    const prices = similarProperties.map(p => p.basePrice)
    const ratings = similarProperties.map(p => p.averageRating)
    const bookings = similarProperties.map(p => p.totalBookings)

    return {
      marketSize: similarProperties.length,
      averagePrice: prices.reduce((sum, p) => sum + p, 0) / prices.length,
      averageRating: ratings.reduce((sum, r) => sum + r, 0) / ratings.length,
      averageBookings: bookings.reduce((sum, b) => sum + b, 0) / bookings.length,
      priceRange: {
        min: Math.min(...prices),
        max: Math.max(...prices)
      },
      pricePercentiles: {
        p25: this.calculatePercentile(prices, 25),
        p50: this.calculatePercentile(prices, 50),
        p75: this.calculatePercentile(prices, 75)
      },
      topPerformers: similarProperties
        .sort((a, b) => (b.totalEarnings || 0) - (a.totalEarnings || 0))
        .slice(0, 3)
        .map(p => ({
          title: p.title,
          price: p.basePrice,
          rating: p.averageRating,
          bookings: p.totalBookings
        }))
    }
  }

  private async getPricingInsights(propertyId: string, startDate: Date, endDate: Date): Promise<any> {
    const [property, bookings, customPricing] = await Promise.all([
      prisma.property.findUnique({
        where: { id: propertyId },
        select: { basePrice: true, city: true, type: true, bedrooms: true }
      }),
      prisma.booking.findMany({
        where: {
          propertyId,
          status: { in: ['CONFIRMED', 'COMPLETED'] },
          createdAt: { gte: startDate, lte: endDate }
        },
        select: {
          totalPrice: true,
          nights: true,
          checkIn: true
        }
      }),
      prisma.propertyAvailability.findMany({
        where: {
          propertyId,
          price: { not: null },
          date: { gte: startDate, lte: endDate }
        },
        select: {
          date: true,
          price: true
        }
      })
    ])

    if (!property) return {}

    // Calculate actual nightly rates from bookings
    const nightlyRates = bookings.map(b => b.totalPrice / b.nights)
    const averageActualRate = nightlyRates.length > 0 
      ? nightlyRates.reduce((sum, rate) => sum + rate, 0) / nightlyRates.length 
      : property.basePrice

    // Analyze seasonal trends
    const seasonalData: Record<string, { bookings: number, averageRate: number }> = {}
    bookings.forEach(booking => {
      const month = booking.checkIn.getMonth() + 1
      const season = this.getSeasonFromMonth(month)
      
      if (!seasonalData[season]) {
        seasonalData[season] = { bookings: 0, averageRate: 0 }
      }
      
      seasonalData[season].bookings += 1
      seasonalData[season].averageRate += booking.totalPrice / booking.nights
    })

    // Calculate average rates per season
    Object.keys(seasonalData).forEach(season => {
      if (seasonalData[season].bookings > 0) {
        seasonalData[season].averageRate = seasonalData[season].averageRate / seasonalData[season].bookings
      }
    })

    return {
      basePrice: property.basePrice,
      averageActualRate: Math.round(averageActualRate * 100) / 100,
      pricePerformance: averageActualRate > property.basePrice ? 'above_base' : 'at_or_below_base',
      totalBookings: bookings.length,
      customPricingDays: customPricing.length,
      seasonalTrends: seasonalData,
      recommendations: {
        suggestedBasePrice: Math.round(averageActualRate * 100) / 100,
        priceAdjustment: Math.round((averageActualRate - property.basePrice) * 100) / 100,
        optimizationPotential: averageActualRate > property.basePrice ? 'increase_base' : 'dynamic_pricing'
      }
    }
  }

  private async generatePropertyRecommendations(property: any, analytics: any): Promise<string[]> {
    const recommendations: string[] = []
    
    // Pricing recommendations
    if (analytics.pricingInsights && analytics.pricingInsights.pricePerformance === 'below_base') {
      recommendations.push(`Considere aumentar o preço base para R$ ${analytics.pricingInsights.recommendations.suggestedBasePrice}`)
    }
    
    // Occupancy recommendations
    if (analytics.occupancyAnalytics && analytics.occupancyAnalytics.occupancyRate < 50) {
      recommendations.push('Taxa de ocupação baixa - considere reduzir preços ou melhorar fotos')
    } else if (analytics.occupancyAnalytics && analytics.occupancyAnalytics.occupancyRate > 85) {
      recommendations.push('Alta demanda! Considere aumentar preços nos fins de semana')
    }
    
    // Review recommendations
    if (analytics.reviewAnalytics && analytics.reviewAnalytics.averageRating < 4.5) {
      const lowestCategory = Object.entries(analytics.reviewAnalytics.detailedRatings)
        .reduce((min, [key, value]) => value < min.value ? { key, value } : min, { key: '', value: 5 })
      
      recommendations.push(`Melhore a categoria "${this.translateRatingCategory(lowestCategory.key)}" para aumentar sua avaliação`)
    }
    
    if (analytics.reviewAnalytics && analytics.reviewAnalytics.responseRate < 80) {
      recommendations.push('Responda mais avaliações para melhorar seu relacionamento com hóspedes')
    }
    
    // Booking recommendations
    if (analytics.bookingAnalytics && analytics.bookingAnalytics.cancellationRate > 15) {
      recommendations.push('Taxa de cancelamento alta - verifique expectativas e descrição da propriedade')
    }
    
    // Competitor recommendations
    if (analytics.competitorAnalysis && analytics.competitorAnalysis.marketSize > 0) {
      const { averagePrice } = analytics.competitorAnalysis
      if (property.basePrice < averagePrice * 0.8) {
        recommendations.push(`Seus preços estão 20% abaixo da média (R$ ${averagePrice.toFixed(2)}) - há espaço para aumento`)
      } else if (property.basePrice > averagePrice * 1.2) {
        recommendations.push(`Seus preços estão acima da média do mercado - considere justificar com diferenciais`)
      }
    }
    
    return recommendations.slice(0, 5) // Limit to 5 recommendations
  }

  private async getMarketBenchmarks(city: string, type: string): Promise<any> {
    const [cityStats, stateStats, nationalStats] = await Promise.all([
      prisma.property.aggregate({
        where: { city, type, status: 'ACTIVE' },
        _avg: { basePrice: true, averageRating: true },
        _count: { id: true }
      }),
      prisma.property.findFirst({
        where: { city, type, status: 'ACTIVE' },
        select: { state: true }
      }).then(prop => 
        prop ? prisma.property.aggregate({
          where: { state: prop.state, type, status: 'ACTIVE' },
          _avg: { basePrice: true, averageRating: true },
          _count: { id: true }
        }) : null
      ),
      prisma.property.aggregate({
        where: { type, status: 'ACTIVE' },
        _avg: { basePrice: true, averageRating: true },
        _count: { id: true }
      })
    ])

    return {
      city: {
        averagePrice: cityStats._avg.basePrice || 0,
        averageRating: cityStats._avg.averageRating || 0,
        totalProperties: cityStats._count
      },
      state: stateStats ? {
        averagePrice: stateStats._avg.basePrice || 0,
        averageRating: stateStats._avg.averageRating || 0,
        totalProperties: stateStats._count
      } : null,
      national: {
        averagePrice: nationalStats._avg.basePrice || 0,
        averageRating: nationalStats._avg.averageRating || 0,
        totalProperties: nationalStats._count
      }
    }
  }

  private async getBookingTrends(propertyId: string, months: number): Promise<any[]> {
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - months)
    
    const bookings = await prisma.booking.findMany({
      where: {
        propertyId,
        createdAt: { gte: startDate },
        status: { in: ['CONFIRMED', 'COMPLETED'] }
      },
      select: {
        createdAt: true,
        totalPrice: true,
        nights: true
      }
    })

    const monthlyData: Record<string, { bookings: number, revenue: number, nights: number }> = {}
    
    bookings.forEach(booking => {
      const monthKey = booking.createdAt.toISOString().substring(0, 7)
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { bookings: 0, revenue: 0, nights: 0 }
      }
      
      monthlyData[monthKey].bookings += 1
      monthlyData[monthKey].revenue += booking.totalPrice
      monthlyData[monthKey].nights += booking.nights
    })

    const result = []
    for (let i = months - 1; i >= 0; i--) {
      const date = new Date()
      date.setMonth(date.getMonth() - i)
      const monthKey = date.toISOString().substring(0, 7)
      
      result.push({
        month: monthKey,
        monthName: date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
        bookings: monthlyData[monthKey]?.bookings || 0,
        revenue: monthlyData[monthKey]?.revenue || 0,
        nights: monthlyData[monthKey]?.nights || 0,
        averageRate: monthlyData[monthKey] && monthlyData[monthKey].nights > 0 
          ? monthlyData[monthKey].revenue / monthlyData[monthKey].nights 
          : 0
      })
    }

    return result
  }

  private async getPricingTrends(propertyId: string, months: number): Promise<any[]> {
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - months)
    
    const [customPricing, bookings] = await Promise.all([
      prisma.propertyAvailability.findMany({
        where: {
          propertyId,
          date: { gte: startDate },
          price: { not: null }
        },
        select: {
          date: true,
          price: true
        }
      }),
      prisma.booking.findMany({
        where: {
          propertyId,
          createdAt: { gte: startDate },
          status: { in: ['CONFIRMED', 'COMPLETED'] }
        },
        select: {
          checkIn: true,
          totalPrice: true,
          nights: true
        }
      })
    ])

    const monthlyPricing: Record<string, { customPrices: number[], bookedRates: number[] }> = {}
    
    // Custom pricing data
    customPricing.forEach(pricing => {
      const monthKey = pricing.date.toISOString().substring(0, 7)
      if (!monthlyPricing[monthKey]) {
        monthlyPricing[monthKey] = { customPrices: [], bookedRates: [] }
      }
      monthlyPricing[monthKey].customPrices.push(pricing.price!)
    })

    // Actual booked rates
    bookings.forEach(booking => {
      const monthKey = booking.checkIn.toISOString().substring(0, 7)
      if (!monthlyPricing[monthKey]) {
        monthlyPricing[monthKey] = { customPrices: [], bookedRates: [] }
      }
      monthlyPricing[monthKey].bookedRates.push(booking.totalPrice / booking.nights)
    })

    const result = []
    for (let i = months - 1; i >= 0; i--) {
      const date = new Date()
      date.setMonth(date.getMonth() - i)
      const monthKey = date.toISOString().substring(0, 7)
      const data = monthlyPricing[monthKey]
      
      result.push({
        month: monthKey,
        monthName: date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
        averageCustomPrice: data && data.customPrices.length > 0 
          ? data.customPrices.reduce((sum, p) => sum + p, 0) / data.customPrices.length 
          : 0,
        averageBookedRate: data && data.bookedRates.length > 0 
          ? data.bookedRates.reduce((sum, r) => sum + r, 0) / data.bookedRates.length 
          : 0,
        customPricingDays: data?.customPrices.length || 0,
        totalBookings: data?.bookedRates.length || 0
      })
    }

    return result
  }

  private async getOccupancyTrends(propertyId: string, months: number): Promise<any[]> {
    const result = []
    
    for (let i = months - 1; i >= 0; i--) {
      const startOfMonth = new Date()
      startOfMonth.setMonth(startOfMonth.getMonth() - i, 1)
      startOfMonth.setHours(0, 0, 0, 0)
      
      const endOfMonth = new Date(startOfMonth)
      endOfMonth.setMonth(endOfMonth.getMonth() + 1, 0)
      endOfMonth.setHours(23, 59, 59, 999)
      
      const daysInMonth = endOfMonth.getDate()
      
      const bookings = await prisma.booking.findMany({
        where: {
          propertyId,
          status: { in: ['CONFIRMED', 'COMPLETED', 'IN_PROGRESS'] },
          OR: [
            {
              AND: [
                { checkIn: { lte: endOfMonth } },
                { checkOut: { gt: startOfMonth } }
              ]
            }
          ]
        },
        select: {
          checkIn: true,
          checkOut: true,
          nights: true
        }
      })
      
      let bookedNights = 0
      bookings.forEach(booking => {
        const bookingStart = booking.checkIn > startOfMonth ? booking.checkIn : startOfMonth
        const bookingEnd = booking.checkOut < endOfMonth ? booking.checkOut : endOfMonth
        const overlapNights = Math.max(0, Math.ceil((bookingEnd.getTime() - bookingStart.getTime()) / (1000 * 60 * 60 * 24)))
        bookedNights += overlapNights
      })
      
      const occupancyRate = daysInMonth > 0 ? (bookedNights / daysInMonth) * 100 : 0
      
      result.push({
        month: startOfMonth.toISOString().substring(0, 7),
        monthName: startOfMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
        totalDays: daysInMonth,
        bookedNights,
        occupancyRate: Math.round(occupancyRate * 100) / 100,
        totalBookings: bookings.length
      })
    }
    
    return result
  }

  private async getRevenueByProperty(hostId: string, startDate: Date, endDate: Date): Promise<any[]> {
    const properties = await prisma.property.findMany({
      where: { hostId },
      select: {
        id: true,
        title: true,
        city: true,
        state: true,
        payments: {
          where: {
            status: 'COMPLETED',
            createdAt: { gte: startDate, lte: endDate }
          },
          select: {
            amount: true,
            booking: {
              select: { nights: true }
            }
          }
        },
        bookings: {
          where: {
            status: { in: ['CONFIRMED', 'COMPLETED'] },
            createdAt: { gte: startDate, lte: endDate }
          },
          select: { id: true }
        }
      }
    })

    return properties.map(property => {
      const totalRevenue = property.payments.reduce((sum, payment) => sum + payment.amount, 0)
      const totalNights = property.payments.reduce((sum, payment) => sum + payment.booking.nights, 0)
      
      return {
        propertyId: property.id,
        title: property.title,
        location: `${property.city}, ${property.state}`,
        revenue: totalRevenue,
        bookings: property.bookings.length,
        totalNights,
        averageNightlyRate: totalNights > 0 ? totalRevenue / totalNights : 0,
        hostEarnings: totalRevenue * 0.9 // 90% to host
      }
    })
  }

  private async getRevenueByMonth(hostId: string, startDate: Date, endDate: Date): Promise<any[]> {
    const payments = await prisma.payment.findMany({
      where: {
        booking: {
          property: { hostId }
        },
        status: 'COMPLETED',
        createdAt: { gte: startDate, lte: endDate }
      },
      select: {
        amount: true,
        createdAt: true,
        booking: {
          select: {
            nights: true,
            property: {
              select: { title: true }
            }
          }
        }
      }
    })

    const monthlyData: Record<string, { revenue: number, bookings: number, nights: number }> = {}
    
    payments.forEach(payment => {
      const monthKey = payment.createdAt.toISOString().substring(0, 7)
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { revenue: 0, bookings: 0, nights: 0 }
      }
      
      monthlyData[monthKey].revenue += payment.amount
      monthlyData[monthKey].bookings += 1
      monthlyData[monthKey].nights += payment.booking.nights
    })

    const result = []
    const start = new Date(startDate)
    const end = new Date(endDate)
    
    while (start <= end) {
      const monthKey = start.toISOString().substring(0, 7)
      const data = monthlyData[monthKey] || { revenue: 0, bookings: 0, nights: 0 }
      
      result.push({
        month: monthKey,
        monthName: start.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
        revenue: data.revenue,
        hostEarnings: data.revenue * 0.9,
        platformFee: data.revenue * 0.1,
        bookings: data.bookings,
        nights: data.nights,
        averageNightlyRate: data.nights > 0 ? data.revenue / data.nights : 0
      })
      
      start.setMonth(start.getMonth() + 1)
    }

    return result
  }

  private async getPayoutHistory(hostId: string, startDate: Date, endDate: Date): Promise<any[]> {
    return await prisma.payout.findMany({
      where: {
        hostId,
        createdAt: { gte: startDate, lte: endDate }
      },
      select: {
        id: true,
        amount: true,
        status: true,
        method: true,
        createdAt: true,
        paidAt: true,
        booking: {
          select: {
            id: true,
            property: {
              select: { title: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    })
  }

  private async getTaxSummary(hostId: string, startDate: Date, endDate: Date): Promise<any> {
    const payments = await prisma.payment.findMany({
      where: {
        booking: {
          property: { hostId }
        },
        status: 'COMPLETED',
        createdAt: { gte: startDate, lte: endDate }
      },
      select: {
        amount: true,
        createdAt: true,
        booking: {
          select: {
            property: {
              select: {
                city: true,
                state: true
              }
            }
          }
        }
      }
    })

    const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0)
    const hostEarnings = totalRevenue * 0.9 // 90% goes to host
    
    // Estimated taxes (simplified - real calculation would be more complex)
    const estimatedIncomeTax = hostEarnings * 0.15 // 15% income tax estimate
    const municipalTax = hostEarnings * 0.05 // 5% municipal tax estimate (varies by city)
    
    const monthlyBreakdown: Record<string, { revenue: number, taxes: number }> = {}
    
    payments.forEach(payment => {
      const monthKey = payment.createdAt.toISOString().substring(0, 7)
      if (!monthlyBreakdown[monthKey]) {
        monthlyBreakdown[monthKey] = { revenue: 0, taxes: 0 }
      }
      
      const hostShare = payment.amount * 0.9
      monthlyBreakdown[monthKey].revenue += hostShare
      monthlyBreakdown[monthKey].taxes += hostShare * 0.2 // 20% total tax estimate
    })

    return {
      totalRevenue,
      hostEarnings,
      platformFee: totalRevenue * 0.1,
      estimatedTaxes: {
        incomeTax: estimatedIncomeTax,
        municipalTax: municipalTax,
        total: estimatedIncomeTax + municipalTax
      },
      netEarnings: hostEarnings - (estimatedIncomeTax + municipalTax),
      monthlyBreakdown,
      disclaimer: 'Estimativas tributárias. Consulte um contador para valores exatos.'
    }
  }

  private async getProjectedRevenue(hostId: string): Promise<any> {
    const today = new Date()
    const next30Days = new Date()
    next30Days.setDate(today.getDate() + 30)
    
    const next90Days = new Date()
    next90Days.setDate(today.getDate() + 90)
    
    const [confirmedBookings, historicalData] = await Promise.all([
      prisma.booking.aggregate({
        where: {
          property: { hostId },
          status: 'CONFIRMED',
          checkIn: { gte: today }
        },
        _sum: { totalPrice: true },
        _count: { id: true }
      }),
      prisma.payment.aggregate({
        where: {
          booking: {
            property: { hostId }
          },
          status: 'COMPLETED',
          createdAt: {
            gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // Last 90 days
          }
        },
        _sum: { amount: true },
        _count: { id: true }
      })
    ])

    const next30DaysConfirmed = confirmedBookings._sum.totalPrice || 0
    const dailyAverage = historicalData._count > 0 
      ? (historicalData._sum.amount || 0) / 90 
      : 0

    return {
      next30Days: next30DaysConfirmed + (dailyAverage * 30 * 0.5), // 50% of historical average as projection
      next90Days: next30DaysConfirmed + (dailyAverage * 90 * 0.4), // 40% of historical average
      confirmedRevenue: next30DaysConfirmed,
      projectedRevenue: dailyAverage * 30 * 0.5,
      dailyAverage,
      confidenceLevel: historicalData._count > 10 ? 'high' : historicalData._count > 5 ? 'medium' : 'low'
    }
  }

  private async getRevenueBySource(hostId: string, startDate: Date, endDate: Date): Promise<any[]> {
    const bookings = await prisma.booking.groupBy({
      by: ['source'],
      where: {
        property: { hostId },
        createdAt: { gte: startDate, lte: endDate },
        status: { in: ['CONFIRMED', 'COMPLETED'] }
      },
      _count: { id: true },
      _sum: { totalPrice: true }
    })

    return bookings.map(booking => ({
      source: booking.source || 'direct',
      bookings: booking._count.id,
      revenue: booking._sum.totalPrice || 0,
      averageValue: booking._count.id > 0 ? (booking._sum.totalPrice || 0) / booking._count.id : 0
    }))
  }

  // Utility functions
  private calculatePercentile(values: number[], percentile: number): number {
    const sorted = values.slice().sort((a, b) => a - b)
    const index = Math.ceil((percentile / 100) * sorted.length) - 1
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))]
  }

  private getSeasonFromMonth(month: number): string {
    if (month >= 12 || month <= 2) return 'summer' // December-February (Brazilian summer)
    if (month >= 3 && month <= 5) return 'autumn'   // March-May
    if (month >= 6 && month <= 8) return 'winter'   // June-August
    return 'spring' // September-November
  }

  private translateRatingCategory(category: string): string {
    const translations: Record<string, string> = {
      cleanliness: 'Limpeza',
      accuracy: 'Precisão',
      checkIn: 'Check-in',
      communication: 'Comunicação',
      location: 'Localização',
      value: 'Custo-benefício'
    }
    return translations[category] || category
  }
}
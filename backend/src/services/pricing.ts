import { prisma } from '@/config/database.js'
import { AIService } from '@/services/ai.js'
import { cacheService } from '@/config/redis.js'

interface MarketConditions {
  averagePrice: number
  occupancyRate: number
  seasonality: 'low' | 'medium' | 'high' | 'peak'
  demandScore: number
  competitorCount: number
}

interface PricingContext {
  propertyId: string
  basePrice: number
  dates: Date[]
  propertyType: string
  bedrooms: number
  location: {
    city: string
    state: string
    neighborhood: string
  }
  amenities: string[]
  reviews: {
    count: number
    averageRating: number
  }
}

interface PricingRecommendation {
  originalPrice: number
  recommendedPrice: number
  adjustmentPercentage: number
  reasoning: string
  confidence: number
  factors: {
    demand: number
    competition: number
    seasonality: number
    property: number
  }
}

export class PricingService {
  private aiService = new AIService()

  // Generate dynamic pricing recommendations
  async generatePricingRecommendations(context: PricingContext): Promise<PricingRecommendation[]> {
    try {
      // Get market conditions for the area
      const marketConditions = await this.getMarketConditions(
        context.location.city,
        context.location.state,
        context.propertyType,
        context.bedrooms
      )

      // Analyze demand patterns
      const demandAnalysis = await this.analyzeDemandPatterns(context.propertyId, context.dates)

      // Get competitor pricing
      const competitorPricing = await this.getCompetitorPricing(context.location, context.propertyType, context.bedrooms)

      // Calculate base adjustments
      const recommendations: PricingRecommendation[] = []

      for (const date of context.dates) {
        const seasonalityFactor = await this.getSeasonalityFactor(date, context.location)
        const demandFactor = this.calculateDemandFactor(date, demandAnalysis)
        const competitionFactor = this.calculateCompetitionFactor(context.basePrice, competitorPricing)
        const propertyFactor = this.calculatePropertyFactor(context)

        // AI-enhanced pricing recommendation
        const aiRecommendation = await this.getAIPricingRecommendation({
          ...context,
          date,
          marketConditions,
          seasonalityFactor,
          demandFactor,
          competitionFactor
        })

        const baseAdjustment = (seasonalityFactor + demandFactor + competitionFactor + propertyFactor) / 4
        const finalAdjustment = aiRecommendation ? (aiRecommendation + baseAdjustment) / 2 : baseAdjustment

        const recommendedPrice = Math.round(context.basePrice * (1 + finalAdjustment))
        const adjustmentPercentage = finalAdjustment * 100

        recommendations.push({
          originalPrice: context.basePrice,
          recommendedPrice,
          adjustmentPercentage: Math.round(adjustmentPercentage * 100) / 100,
          reasoning: this.generatePricingReasoning(seasonalityFactor, demandFactor, competitionFactor, propertyFactor),
          confidence: this.calculateConfidence(marketConditions, context),
          factors: {
            demand: Math.round(demandFactor * 100),
            competition: Math.round(competitionFactor * 100),
            seasonality: Math.round(seasonalityFactor * 100),
            property: Math.round(propertyFactor * 100)
          }
        })
      }

      return recommendations
    } catch (error) {
      console.error('Error generating pricing recommendations:', error)
      return []
    }
  }

  // Get market conditions for a specific area
  private async getMarketConditions(city: string, state: string, type: string, bedrooms: number): Promise<MarketConditions> {
    const cacheKey = `market_conditions:${city}:${state}:${type}:${bedrooms}`
    const cached = await cacheService.get(cacheKey)
    
    if (cached) {
      return JSON.parse(cached)
    }

    // Get similar properties in the area
    const similarProperties = await prisma.property.findMany({
      where: {
        city,
        state,
        type,
        bedrooms,
        status: 'ACTIVE'
      },
      select: {
        basePrice: true,
        averageRating: true,
        reviewCount: true,
        totalBookings: true,
        bookings: {
          where: {
            status: { in: ['CONFIRMED', 'COMPLETED'] },
            createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
          },
          select: {
            totalPrice: true,
            nights: true
          }
        }
      }
    })

    if (similarProperties.length === 0) {
      return {
        averagePrice: 0,
        occupancyRate: 0,
        seasonality: 'medium',
        demandScore: 50,
        competitorCount: 0
      }
    }

    const averagePrice = similarProperties.reduce((sum, p) => sum + p.basePrice, 0) / similarProperties.length
    const totalBookings = similarProperties.reduce((sum, p) => sum + p.totalBookings, 0)
    const recentBookings = similarProperties.reduce((sum, p) => sum + p.bookings.length, 0)
    
    // Estimate occupancy rate based on recent bookings
    const estimatedOccupancy = Math.min((recentBookings / similarProperties.length) * 100 / 30, 100)
    
    // Calculate demand score based on booking frequency and pricing
    const demandScore = Math.min(((recentBookings / similarProperties.length) * 10) + (estimatedOccupancy * 0.5), 100)

    const conditions: MarketConditions = {
      averagePrice: Math.round(averagePrice),
      occupancyRate: Math.round(estimatedOccupancy * 100) / 100,
      seasonality: this.determineSeasonality(new Date()),
      demandScore: Math.round(demandScore),
      competitorCount: similarProperties.length
    }

    // Cache for 4 hours
    await cacheService.set(cacheKey, JSON.stringify(conditions), 14400)

    return conditions
  }

  // Analyze demand patterns for a property
  private async analyzeDemandPatterns(propertyId: string, dates: Date[]): Promise<any> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    
    const recentBookings = await prisma.booking.findMany({
      where: {
        propertyId,
        createdAt: { gte: thirtyDaysAgo },
        status: { in: ['CONFIRMED', 'COMPLETED', 'PENDING'] }
      },
      select: {
        checkIn: true,
        checkOut: true,
        totalPrice: true,
        nights: true,
        createdAt: true
      }
    })

    const bookingsByDay = new Map<string, number>()
    const pricesByDay = new Map<string, number[]>()

    recentBookings.forEach(booking => {
      const dayKey = booking.checkIn.toISOString().slice(0, 10)
      bookingsByDay.set(dayKey, (bookingsByDay.get(dayKey) || 0) + 1)
      
      if (!pricesByDay.has(dayKey)) {
        pricesByDay.set(dayKey, [])
      }
      pricesByDay.get(dayKey)!.push(booking.totalPrice / booking.nights)
    })

    return {
      averageBookingsPerDay: recentBookings.length / 30,
      peakDays: Array.from(bookingsByDay.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 7)
        .map(([day]) => day),
      averageDailyRate: recentBookings.length > 0 
        ? recentBookings.reduce((sum, b) => sum + (b.totalPrice / b.nights), 0) / recentBookings.length
        : 0
    }
  }

  // Get competitor pricing in the area
  private async getCompetitorPricing(location: any, type: string, bedrooms: number): Promise<number[]> {
    const competitors = await prisma.property.findMany({
      where: {
        city: location.city,
        state: location.state,
        type,
        bedrooms,
        status: 'ACTIVE'
      },
      select: {
        basePrice: true,
        averageRating: true
      },
      take: 20,
      orderBy: {
        averageRating: 'desc'
      }
    })

    return competitors.map(c => c.basePrice)
  }

  // Get AI-enhanced pricing recommendation
  private async getAIPricingRecommendation(context: any): Promise<number | null> {
    if (!this.aiService.getStatus().isReady) {
      return null
    }

    try {
      const prompt = `Como especialista em precificação de hospedagem, analise:

Propriedade: ${context.propertyType} com ${context.bedrooms} quartos
Localização: ${context.location.neighborhood}, ${context.location.city}, ${context.location.state}
Preço base: R$ ${context.basePrice}
Data: ${context.date.toISOString().slice(0, 10)}
Avaliação média: ${context.reviews.averageRating} (${context.reviews.count} avaliações)

Condições do mercado:
- Preço médio da região: R$ ${context.marketConditions.averagePrice}
- Taxa de ocupação: ${context.marketConditions.occupancyRate}%
- Nível de demanda: ${context.marketConditions.demandScore}/100
- Concorrentes: ${context.marketConditions.competitorCount}

Fatores atuais:
- Sazonalidade: ${context.seasonalityFactor > 0 ? '+' : ''}${(context.seasonalityFactor * 100).toFixed(1)}%
- Demanda: ${context.demandFactor > 0 ? '+' : ''}${(context.demandFactor * 100).toFixed(1)}%
- Competição: ${context.competitionFactor > 0 ? '+' : ''}${(context.competitionFactor * 100).toFixed(1)}%

Recomende um ajuste percentual (-50% a +100%) considerando maximizar receita e ocupação.
Responda apenas com o número decimal (ex: 0.15 para 15% de aumento).`

      const response = await this.aiService.generatePricingRecommendation(prompt, context.marketConditions)
      
      if (response && typeof response === 'string') {
        const adjustment = parseFloat(response.replace(/[^\d.-]/g, ''))
        if (!isNaN(adjustment) && adjustment >= -0.5 && adjustment <= 1.0) {
          return adjustment
        }
      }
    } catch (error) {
      console.error('AI pricing recommendation error:', error)
    }

    return null
  }

  // Calculate various pricing factors
  private getSeasonalityFactor(date: Date, location: any): number {
    const month = date.getMonth()
    const isBeachCity = ['Rio de Janeiro', 'Salvador', 'Fortaleza', 'Recife', 'Florianópolis'].includes(location.city)
    const isMountainCity = ['Gramado', 'Campos do Jordão', 'Petrópolis'].includes(location.city)
    
    // Brazilian summer (Dec-Mar)
    if (month >= 11 || month <= 2) {
      return isBeachCity ? 0.3 : 0.1
    }
    
    // Brazilian winter (Jun-Sep) 
    if (month >= 5 && month <= 8) {
      return isMountainCity ? 0.25 : (isBeachCity ? -0.1 : 0)
    }
    
    // Shoulder seasons
    return 0.05
  }

  private calculateDemandFactor(date: Date, demandAnalysis: any): number {
    const dayOfWeek = date.getDay()
    const isWeekend = dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0
    
    let factor = 0
    
    // Weekend premium
    if (isWeekend) {
      factor += 0.15
    }
    
    // High demand based on historical data
    if (demandAnalysis.averageBookingsPerDay > 2) {
      factor += 0.1
    }
    
    return Math.min(factor, 0.3)
  }

  private calculateCompetitionFactor(basePrice: number, competitorPrices: number[]): number {
    if (competitorPrices.length === 0) return 0
    
    const avgCompetitorPrice = competitorPrices.reduce((a, b) => a + b, 0) / competitorPrices.length
    const priceDifference = (basePrice - avgCompetitorPrice) / avgCompetitorPrice
    
    // If we're more expensive than average, suggest decrease
    if (priceDifference > 0.1) {
      return -0.1
    }
    
    // If we're significantly cheaper, suggest increase
    if (priceDifference < -0.2) {
      return 0.15
    }
    
    return 0
  }

  private calculatePropertyFactor(context: PricingContext): number {
    let factor = 0
    
    // Rating bonus
    if (context.reviews.averageRating >= 4.5 && context.reviews.count >= 10) {
      factor += 0.1
    } else if (context.reviews.averageRating >= 4.0 && context.reviews.count >= 5) {
      factor += 0.05
    }
    
    // Premium amenities
    const premiumAmenities = ['pool', 'wifi', 'kitchen', 'parking', 'air_conditioning']
    const hasPreimumAmenities = context.amenities.some(a => premiumAmenities.includes(a))
    if (hasPreimumAmenities) {
      factor += 0.05
    }
    
    return Math.min(factor, 0.2)
  }

  private determineSeasonality(date: Date): 'low' | 'medium' | 'high' | 'peak' {
    const month = date.getMonth()
    
    // Brazilian peak season (December-February)
    if (month >= 11 || month <= 1) return 'peak'
    
    // High season (March, July)
    if (month === 2 || month === 6) return 'high'
    
    // Low season (April-May, August-October)
    if ((month >= 3 && month <= 4) || (month >= 7 && month <= 9)) return 'low'
    
    return 'medium'
  }

  private generatePricingReasoning(seasonality: number, demand: number, competition: number, property: number): string {
    const factors = []
    
    if (seasonality > 0.1) factors.push('alta temporada')
    if (seasonality < -0.05) factors.push('baixa temporada')
    if (demand > 0.1) factors.push('alta demanda')
    if (competition > 0.05) factors.push('preços competitivos baixos')
    if (competition < -0.05) factors.push('preços acima do mercado')
    if (property > 0.05) factors.push('propriedade bem avaliada')
    
    if (factors.length === 0) {
      return 'Manter preço atual baseado nas condições de mercado'
    }
    
    return `Ajuste recomendado devido a: ${factors.join(', ')}`
  }

  private calculateConfidence(marketConditions: MarketConditions, context: PricingContext): number {
    let confidence = 50
    
    // More competitors = higher confidence
    if (marketConditions.competitorCount >= 10) confidence += 20
    else if (marketConditions.competitorCount >= 5) confidence += 10
    
    // More reviews = higher confidence
    if (context.reviews.count >= 20) confidence += 15
    else if (context.reviews.count >= 10) confidence += 10
    else if (context.reviews.count >= 5) confidence += 5
    
    // Market data quality
    if (marketConditions.occupancyRate > 0) confidence += 15
    
    return Math.min(confidence, 95)
  }

  // Apply pricing rules automatically
  async applyAutomaticPricing(propertyId: string): Promise<void> {
    try {
      const property = await prisma.property.findUnique({
        where: { id: propertyId },
        include: {
          pricingRules: {
            where: { isActive: true }
          },
          amenities: {
            include: { amenity: true }
          }
        }
      })

      if (!property) return

      const context: PricingContext = {
        propertyId: property.id,
        basePrice: property.basePrice,
        dates: this.getNext30Days(),
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

      const recommendations = await this.generatePricingRecommendations(context)

      // Apply recommendations to availability calendar
      for (let i = 0; i < recommendations.length; i++) {
        const recommendation = recommendations[i]
        const date = context.dates[i]

        // Update pricing rules based on recommendations
        if (recommendation.confidence >= 70) {
          await this.updateDailyPricing(propertyId, date, recommendation.recommendedPrice)
        }
      }

      // Log pricing changes
      await prisma.pricingRule.create({
        data: {
          propertyId,
          name: 'Automatic Dynamic Pricing',
          type: 'DYNAMIC',
          isActive: true,
          conditions: recommendations.map(r => ({
            confidence: r.confidence,
            adjustment: r.adjustmentPercentage,
            reasoning: r.reasoning
          })),
          createdAt: new Date()
        }
      })

    } catch (error) {
      console.error('Error applying automatic pricing:', error)
    }
  }

  private async updateDailyPricing(propertyId: string, date: Date, price: number): Promise<void> {
    await prisma.propertyAvailability.upsert({
      where: {
        propertyId_date: {
          propertyId,
          date
        }
      },
      update: {
        price
      },
      create: {
        propertyId,
        date,
        price,
        isBlocked: false
      }
    })
  }

  private getNext30Days(): Date[] {
    const dates = []
    for (let i = 0; i < 30; i++) {
      const date = new Date()
      date.setDate(date.getDate() + i)
      dates.push(date)
    }
    return dates
  }
}
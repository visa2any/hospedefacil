import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { prisma } from '@/config/database.js'
import { cacheService } from '@/config/redis.js'
import { GeocodeService } from '@/services/geocode.js'
import { AIService } from '@/services/ai.js'
import { business } from '@/config/environment.js'

// Search schemas
const searchSchema = z.object({
  // Location
  destination: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  radius: z.number().min(1).max(100).default(25), // km
  
  // Dates
  checkIn: z.string().datetime().optional(),
  checkOut: z.string().datetime().optional(),
  
  // Guests
  adults: z.number().int().min(1).max(20).default(2),
  children: z.number().int().min(0).max(10).default(0),
  infants: z.number().int().min(0).max(5).default(0),
  pets: z.number().int().min(0).max(5).default(0),
  
  // Filters
  minPrice: z.number().min(0).optional(),
  maxPrice: z.number().min(0).optional(),
  propertyTypes: z.array(z.enum(['APARTMENT', 'HOUSE', 'CONDO', 'LOFT', 'STUDIO', 'FARM', 'CHALET', 'BOAT', 'OTHER'])).optional(),
  bedrooms: z.number().int().min(0).optional(),
  bathrooms: z.number().int().min(0).optional(),
  amenities: z.array(z.string()).optional(),
  
  // Host filters
  superHostOnly: z.boolean().default(false),
  instantBook: z.boolean().default(false),
  
  // Preferences
  smokingAllowed: z.boolean().optional(),
  petsAllowed: z.boolean().optional(),
  partiesAllowed: z.boolean().optional(),
  
  // Sorting and pagination
  sort: z.enum(['relevance', 'price-asc', 'price-desc', 'rating', 'distance', 'newest']).default('relevance'),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(50).default(20),
  
  // AI features
  useAI: z.boolean().default(false),
  naturalQuery: z.string().optional(),
})

const suggestionsSchema = z.object({
  query: z.string().min(2).max(100),
  limit: z.number().int().min(1).max(10).default(5),
})

const nearbySchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  radius: z.number().min(1).max(50).default(10),
  limit: z.number().int().min(1).max(20).default(10),
})

export class SearchController {
  private geocodeService = new GeocodeService()
  private aiService = new AIService()

  // Main search endpoint
  async search(request: FastifyRequest, reply: FastifyReply) {
    try {
      const params = searchSchema.parse(request.query)
      const userId = request.user?.id

      // Generate cache key
      const cacheKey = `search:${Buffer.from(JSON.stringify(params)).toString('base64')}`
      
      // Try cache first
      const cached = await cacheService.getCachedSearchResults(JSON.stringify(params))
      if (cached && !userId) { // Don't use cache for logged in users (personalized results)
        return reply.send(cached)
      }

      // Process natural language query with AI
      if (params.useAI && params.naturalQuery) {
        try {
          const aiEnhancedParams = await this.aiService.enhanceSearchQuery(params.naturalQuery, params)
          Object.assign(params, aiEnhancedParams)
        } catch (error) {
          request.log.warn('AI query enhancement failed:', error)
        }
      }

      // Geocode destination if provided
      let searchCoordinates = null
      if (params.destination) {
        const geocodeResult = await this.geocodeService.geocode(`${params.destination}, Brasil`)
        if (geocodeResult) {
          searchCoordinates = {
            latitude: geocodeResult.lat,
            longitude: geocodeResult.lng
          }
        }
      } else if (params.latitude && params.longitude) {
        searchCoordinates = {
          latitude: params.latitude,
          longitude: params.longitude
        }
      }

      // Build where clause
      const where = this.buildSearchWhere(params, searchCoordinates)

      // Build order by clause
      const orderBy = this.buildSearchOrderBy(params, searchCoordinates)

      // Get total count
      const totalCount = await prisma.property.count({ where })

      // Execute search with availability check if dates provided
      let properties
      if (params.checkIn && params.checkOut) {
        properties = await this.searchWithAvailability(where, orderBy, params)
      } else {
        properties = await this.searchWithoutDates(where, orderBy, params)
      }

      // Calculate distances if coordinates available
      if (searchCoordinates) {
        properties = properties.map(property => ({
          ...property,
          distance: this.calculateDistance(
            searchCoordinates.latitude,
            searchCoordinates.longitude,
            property.latitude,
            property.longitude
          )
        }))

        // Re-sort by distance if needed
        if (params.sort === 'distance') {
          properties.sort((a, b) => a.distance - b.distance)
        }
      }

      // Apply AI personalization for logged-in users
      if (userId && properties.length > 0) {
        try {
          properties = await this.aiService.personalizeSearchResults(userId, properties)
        } catch (error) {
          request.log.warn('AI personalization failed:', error)
        }
      }

      // Calculate pricing with fees
      properties = properties.map(property => {
        const nights = params.checkIn && params.checkOut 
          ? Math.ceil((new Date(params.checkOut).getTime() - new Date(params.checkIn).getTime()) / (1000 * 60 * 60 * 24))
          : 1

        const baseTotal = property.basePrice * nights
        const cleaningFee = property.cleaningFee
        const serviceFee = baseTotal * business.platformFeePercent
        const taxes = baseTotal * business.taxPercent
        const totalPrice = baseTotal + cleaningFee + serviceFee + taxes

        return {
          ...property,
          nights,
          pricing: {
            basePrice: property.basePrice,
            baseTotal,
            cleaningFee,
            serviceFee,
            taxes,
            totalPrice,
            pricePerNight: property.basePrice
          }
        }
      })

      // Build result
      const result = {
        properties: properties.map(property => ({
          id: property.id,
          title: property.title,
          slug: property.slug,
          type: property.type,
          city: property.city,
          state: property.state,
          neighborhood: property.neighborhood,
          bedrooms: property.bedrooms,
          bathrooms: property.bathrooms,
          maxGuests: property.maxGuests,
          basePrice: property.basePrice,
          pricing: property.pricing,
          averageRating: property.averageRating,
          reviewCount: property._count?.reviews || 0,
          images: property.images || [],
          amenities: property.amenities?.map(pa => pa.amenity) || [],
          host: {
            id: property.host?.id,
            name: property.host?.name,
            avatar: property.host?.avatar,
            isSuperHost: property.host?.hostProfile?.isSuperHost || false,
          },
          distance: property.distance,
          coordinates: {
            latitude: property.latitude,
            longitude: property.longitude
          }
        })),
        filters: await this.buildFiltersResponse(where),
        pagination: {
          page: params.page,
          limit: params.limit,
          total: totalCount,
          pages: Math.ceil(totalCount / params.limit),
        },
        searchInfo: {
          destination: params.destination,
          coordinates: searchCoordinates,
          checkIn: params.checkIn,
          checkOut: params.checkOut,
          guests: {
            adults: params.adults,
            children: params.children,
            infants: params.infants,
            pets: params.pets,
            total: params.adults + params.children + params.infants
          },
          nights: params.checkIn && params.checkOut 
            ? Math.ceil((new Date(params.checkOut).getTime() - new Date(params.checkIn).getTime()) / (1000 * 60 * 60 * 24))
            : null
        }
      }

      // Cache for 5 minutes (shorter for search results)
      if (!userId) {
        await cacheService.cacheSearchResults(JSON.stringify(params), result, 300)
      }

      return reply.send(result)

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Parâmetros inválidos',
          details: error.errors
        })
      }

      request.log.error('Search error:', error)
      return reply.status(500).send({
        error: 'Erro interno',
        message: 'Não foi possível realizar a busca.'
      })
    }
  }

  // Search suggestions
  async getSuggestions(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { query, limit } = suggestionsSchema.parse(request.query)
      const cacheKey = `suggestions:${query}:${limit}`

      // Try cache first
      const cached = await cacheService.get(cacheKey)
      if (cached) {
        return reply.send(JSON.parse(cached))
      }

      // Search cities, neighborhoods, and property titles
      const suggestions = await prisma.$queryRaw`
        SELECT DISTINCT 
          'city' as type,
          city as name,
          state,
          COUNT(*) as count
        FROM properties 
        WHERE status = 'ACTIVE' 
          AND (LOWER(city) LIKE ${`%${query.toLowerCase()}%`} 
               OR LOWER(neighborhood) LIKE ${`%${query.toLowerCase()}%`})
        GROUP BY city, state
        UNION ALL
        SELECT DISTINCT 
          'neighborhood' as type,
          neighborhood as name,
          state,
          COUNT(*) as count
        FROM properties 
        WHERE status = 'ACTIVE' 
          AND LOWER(neighborhood) LIKE ${`%${query.toLowerCase()}%`}
        GROUP BY neighborhood, state
        ORDER BY count DESC
        LIMIT ${limit}
      `

      const result = { suggestions }

      // Cache for 1 hour
      await cacheService.set(cacheKey, JSON.stringify(result), 3600)

      return reply.send(result)

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Parâmetros inválidos',
          details: error.errors
        })
      }

      request.log.error('Get suggestions error:', error)
      return reply.status(500).send({
        error: 'Erro interno',
        message: 'Não foi possível obter sugestões.'
      })
    }
  }

  // Nearby properties
  async getNearby(request: FastifyRequest, reply: FastifyReply) {
    try {
      const params = nearbySchema.parse(request.query)
      const cacheKey = `nearby:${params.latitude}:${params.longitude}:${params.radius}:${params.limit}`

      // Try cache first
      const cached = await cacheService.get(cacheKey)
      if (cached) {
        return reply.send(JSON.parse(cached))
      }

      // Search properties within radius using PostGIS or approximation
      const properties = await prisma.$queryRaw`
        SELECT 
          p.*,
          ( 6371 * acos( cos( radians(${params.latitude}) ) 
            * cos( radians( p.latitude ) ) 
            * cos( radians( p.longitude ) - radians(${params.longitude}) ) 
            + sin( radians(${params.latitude}) ) 
            * sin( radians( p.latitude ) ) 
          ) ) AS distance
        FROM properties p
        WHERE p.status = 'ACTIVE'
        HAVING distance <= ${params.radius}
        ORDER BY distance
        LIMIT ${params.limit}
      `

      const result = { properties }

      // Cache for 30 minutes
      await cacheService.set(cacheKey, JSON.stringify(result), 1800)

      return reply.send(result)

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Parâmetros inválidos',
          details: error.errors
        })
      }

      request.log.error('Get nearby error:', error)
      return reply.status(500).send({
        error: 'Erro interno',
        message: 'Não foi possível buscar propriedades próximas.'
      })
    }
  }

  // Popular destinations
  async getPopularDestinations(request: FastifyRequest, reply: FastifyReply) {
    try {
      const cacheKey = 'popular-destinations'

      // Try cache first
      const cached = await cacheService.get(cacheKey)
      if (cached) {
        return reply.send(JSON.parse(cached))
      }

      // Get cities with most properties
      const destinations = await prisma.property.groupBy({
        by: ['city', 'state'],
        where: { status: 'ACTIVE' },
        _count: { id: true },
        _avg: { basePrice: true },
        orderBy: { _count: { id: 'desc' } },
        take: 20,
      })

      // Get sample images for each destination
      const destinationsWithImages = await Promise.all(
        destinations.map(async (dest) => {
          const sampleProperty = await prisma.property.findFirst({
            where: {
              city: dest.city,
              state: dest.state,
              status: 'ACTIVE'
            },
            include: {
              images: {
                take: 1,
                orderBy: { order: 'asc' }
              }
            }
          })

          return {
            city: dest.city,
            state: dest.state,
            propertyCount: dest._count.id,
            averagePrice: dest._avg.basePrice ? Math.round(dest._avg.basePrice) : null,
            image: sampleProperty?.images[0]?.url || null,
          }
        })
      )

      const result = { destinations: destinationsWithImages }

      // Cache for 6 hours
      await cacheService.set(cacheKey, JSON.stringify(result), 21600)

      return reply.send(result)

    } catch (error) {
      request.log.error('Get popular destinations error:', error)
      return reply.status(500).send({
        error: 'Erro interno',
        message: 'Não foi possível carregar destinos populares.'
      })
    }
  }

  // Helper methods
  private buildSearchWhere(params: any, coordinates: any) {
    const where: any = {
      status: 'ACTIVE',
    }

    // Location filter
    if (params.destination && !coordinates) {
      where.OR = [
        { city: { contains: params.destination, mode: 'insensitive' } },
        { neighborhood: { contains: params.destination, mode: 'insensitive' } },
        { state: { contains: params.destination, mode: 'insensitive' } }
      ]
    }

    // Guest capacity
    const totalGuests = params.adults + params.children + params.infants
    if (totalGuests > 0) {
      where.maxGuests = { gte: totalGuests }
    }

    // Property filters
    if (params.propertyTypes?.length > 0) {
      where.type = { in: params.propertyTypes }
    }

    if (params.bedrooms !== undefined) {
      where.bedrooms = { gte: params.bedrooms }
    }

    if (params.bathrooms !== undefined) {
      where.bathrooms = { gte: params.bathrooms }
    }

    // Price filters
    if (params.minPrice || params.maxPrice) {
      where.basePrice = {}
      if (params.minPrice) where.basePrice.gte = params.minPrice
      if (params.maxPrice) where.basePrice.lte = params.maxPrice
    }

    // Amenities filter
    if (params.amenities?.length > 0) {
      where.amenities = {
        some: {
          amenityId: { in: params.amenities }
        }
      }
    }

    // House rules filters
    if (params.smokingAllowed === true) where.smokingAllowed = true
    if (params.petsAllowed === true) where.petsAllowed = true
    if (params.partiesAllowed === true) where.partiesAllowed = true

    // Pets requirement
    if (params.pets > 0) {
      where.petsAllowed = true
    }

    return where
  }

  private buildSearchOrderBy(params: any, coordinates: any) {
    switch (params.sort) {
      case 'price-asc':
        return { basePrice: 'asc' }
      case 'price-desc':
        return { basePrice: 'desc' }
      case 'rating':
        return { averageRating: 'desc' }
      case 'newest':
        return { createdAt: 'desc' }
      case 'distance':
        // Distance sorting handled after query
        return { createdAt: 'desc' }
      case 'relevance':
      default:
        return [
          { averageRating: 'desc' },
          { reviewCount: 'desc' },
          { createdAt: 'desc' }
        ]
    }
  }

  private async searchWithAvailability(where: any, orderBy: any, params: any) {
    const checkIn = new Date(params.checkIn!)
    const checkOut = new Date(params.checkOut!)

    return await prisma.property.findMany({
      where: {
        ...where,
        // Check availability for the date range
        NOT: {
          availability: {
            some: {
              date: {
                gte: checkIn,
                lt: checkOut,
              },
              isBlocked: true
            }
          }
        },
        // Check for existing bookings
        NOT: {
          bookings: {
            some: {
              status: { in: ['CONFIRMED', 'IN_PROGRESS'] },
              OR: [
                {
                  AND: [
                    { checkIn: { lte: checkIn } },
                    { checkOut: { gt: checkIn } }
                  ]
                },
                {
                  AND: [
                    { checkIn: { lt: checkOut } },
                    { checkOut: { gte: checkOut } }
                  ]
                },
                {
                  AND: [
                    { checkIn: { gte: checkIn } },
                    { checkOut: { lte: checkOut } }
                  ]
                }
              ]
            }
          }
        }
      },
      orderBy,
      skip: (params.page - 1) * params.limit,
      take: params.limit,
      include: {
        images: {
          take: 1,
          orderBy: { order: 'asc' }
        },
        amenities: {
          include: { amenity: true }
        },
        host: {
          select: {
            id: true,
            name: true,
            avatar: true,
            hostProfile: {
              select: {
                isSuperHost: true,
                averageRating: true,
              }
            }
          }
        },
        _count: {
          select: { reviews: true }
        }
      }
    })
  }

  private async searchWithoutDates(where: any, orderBy: any, params: any) {
    return await prisma.property.findMany({
      where,
      orderBy,
      skip: (params.page - 1) * params.limit,
      take: params.limit,
      include: {
        images: {
          take: 1,
          orderBy: { order: 'asc' }
        },
        amenities: {
          include: { amenity: true }
        },
        host: {
          select: {
            id: true,
            name: true,
            avatar: true,
            hostProfile: {
              select: {
                isSuperHost: true,
                averageRating: true,
              }
            }
          }
        },
        _count: {
          select: { reviews: true }
        }
      }
    })
  }

  private async buildFiltersResponse(where: any) {
    // Get available amenities
    const amenities = await prisma.amenity.findMany({
      include: {
        _count: {
          select: {
            properties: {
              where: { property: where }
            }
          }
        }
      }
    })

    // Get price range
    const priceRange = await prisma.property.aggregate({
      where,
      _min: { basePrice: true },
      _max: { basePrice: true }
    })

    return {
      amenities: amenities.map(a => ({
        id: a.id,
        name: a.name,
        icon: a.icon,
        count: a._count.properties
      })),
      priceRange: {
        min: priceRange._min.basePrice || 0,
        max: priceRange._max.basePrice || 1000
      }
    }
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371 // Earth's radius in kilometers
    const dLat = this.deg2rad(lat2 - lat1)
    const dLon = this.deg2rad(lon2 - lon1)
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
              Math.sin(dLon/2) * Math.sin(dLon/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    const d = R * c
    return Math.round(d * 100) / 100 // Round to 2 decimal places
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI/180)
  }
}
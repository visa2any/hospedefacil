import { prisma } from '@/config/database.js'
import { AIService } from '@/services/ai.js'
import { cacheService } from '@/config/redis.js'

interface SearchFilters {
  query?: string
  city?: string
  state?: string
  checkIn?: Date
  checkOut?: Date
  adults?: number
  children?: number
  minPrice?: number
  maxPrice?: number
  propertyType?: string[]
  bedrooms?: number
  bathrooms?: number
  amenities?: string[]
  instantBook?: boolean
  superHost?: boolean
  minRating?: number
  sortBy?: 'relevance' | 'price-asc' | 'price-desc' | 'rating' | 'distance'
  page?: number
  limit?: number
  latitude?: number
  longitude?: number
  radius?: number // km
}

interface SearchResult {
  id: string
  title: string
  description: string
  type: string
  city: string
  state: string
  neighborhood: string
  basePrice: number
  cleaningFee: number
  serviceFee: number
  averageRating: number
  reviewCount: number
  bedrooms: number
  bathrooms: number
  beds: number
  maxGuests: number
  images: Array<{
    url: string
    alt?: string
  }>
  host: {
    id: string
    name: string
    avatar?: string
    isSuperHost: boolean
    responseRate: number
  }
  amenities: string[]
  distance?: number
  instantBook: boolean
  availability?: {
    available: boolean
    nights?: number
    totalPrice?: number
  }
  relevanceScore?: number
}

interface SearchResponse {
  results: SearchResult[]
  total: number
  page: number
  pages: number
  filters: SearchFilters
  suggestions: string[]
  facets: {
    priceRanges: Array<{ range: string, count: number }>
    propertyTypes: Array<{ type: string, count: number }>
    amenities: Array<{ amenity: string, count: number }>
    cities: Array<{ city: string, count: number }>
  }
  searchTime: number
}

export class SearchService {
  private aiService = new AIService()

  // Main search method
  async search(filters: SearchFilters): Promise<SearchResponse> {
    const startTime = Date.now()
    const cacheKey = `search:${JSON.stringify(filters)}`

    try {
      // Check cache first (cache for 5 minutes for search results)
      const cached = await cacheService.get(cacheKey)
      if (cached) {
        const result = JSON.parse(cached) as SearchResponse
        result.searchTime = Date.now() - startTime
        return result
      }

      // Process natural language query if present
      let processedFilters = filters
      if (filters.query) {
        processedFilters = await this.processNaturalLanguageQuery(filters)
      }

      // Build database query
      const whereClause = this.buildWhereClause(processedFilters)
      const orderBy = this.buildOrderBy(processedFilters.sortBy)

      // Execute search query
      const [properties, totalCount] = await Promise.all([
        prisma.property.findMany({
          where: whereClause,
          include: {
            images: {
              take: 5,
              orderBy: { order: 'asc' },
              select: { url: true, alt: true }
            },
            host: {
              select: {
                id: true,
                name: true,
                avatar: true,
                hostProfile: {
                  select: {
                    isSuperHost: true,
                    responseRate: true
                  }
                }
              }
            },
            amenities: {
              include: {
                amenity: {
                  select: { name: true, icon: true }
                }
              }
            },
            _count: {
              select: { reviews: true }
            }
          },
          orderBy,
          skip: ((processedFilters.page || 1) - 1) * (processedFilters.limit || 20),
          take: processedFilters.limit || 20
        }),
        prisma.property.count({ where: whereClause })
      ])

      // Check availability if dates provided
      const results = await this.enrichWithAvailability(properties, processedFilters)

      // Calculate distances if location provided
      const resultsWithDistance = this.calculateDistances(results, processedFilters)

      // Get search facets
      const facets = await this.getSearchFacets(whereClause)

      // Get suggestions
      const suggestions = await this.getSearchSuggestions(filters.query || '')

      const searchResponse: SearchResponse = {
        results: resultsWithDistance.map(property => this.formatSearchResult(property, processedFilters)),
        total: totalCount,
        page: processedFilters.page || 1,
        pages: Math.ceil(totalCount / (processedFilters.limit || 20)),
        filters: processedFilters,
        suggestions,
        facets,
        searchTime: Date.now() - startTime
      }

      // Cache results
      await cacheService.set(cacheKey, JSON.stringify(searchResponse), 300)

      return searchResponse

    } catch (error) {
      console.error('Search error:', error)
      return {
        results: [],
        total: 0,
        page: 1,
        pages: 0,
        filters,
        suggestions: [],
        facets: { priceRanges: [], propertyTypes: [], amenities: [], cities: [] },
        searchTime: Date.now() - startTime
      }
    }
  }

  // Process natural language queries using AI
  private async processNaturalLanguageQuery(filters: SearchFilters): Promise<SearchFilters> {
    if (!filters.query || !this.aiService.getStatus().isReady) {
      return filters
    }

    try {
      const analysis = await this.aiService.processNaturalLanguageSearch(filters.query)
      
      if (analysis) {
        return {
          ...filters,
          ...(analysis.location && { city: analysis.location.city, state: analysis.location.state }),
          ...(analysis.dates && { 
            checkIn: new Date(analysis.dates.checkIn), 
            checkOut: new Date(analysis.dates.checkOut) 
          }),
          ...(analysis.guests && { 
            adults: analysis.guests.adults, 
            children: analysis.guests.children 
          }),
          ...(analysis.priceRange && { 
            minPrice: analysis.priceRange.min, 
            maxPrice: analysis.priceRange.max 
          }),
          ...(analysis.propertyType && { propertyType: [analysis.propertyType] }),
          ...(analysis.amenities && { amenities: analysis.amenities })
        }
      }
    } catch (error) {
      console.warn('Natural language processing failed:', error)
    }

    return filters
  }

  // Build Prisma where clause from filters
  private buildWhereClause(filters: SearchFilters): any {
    const where: any = {
      status: 'ACTIVE'
    }

    // Text search
    if (filters.query) {
      const searchTerms = filters.query.split(' ').filter(term => term.length > 2)
      where.OR = [
        { title: { contains: filters.query, mode: 'insensitive' } },
        { description: { contains: filters.query, mode: 'insensitive' } },
        { city: { contains: filters.query, mode: 'insensitive' } },
        { neighborhood: { contains: filters.query, mode: 'insensitive' } },
        ...searchTerms.map(term => ({ 
          title: { contains: term, mode: 'insensitive' } 
        }))
      ]
    }

    // Location filters
    if (filters.city) {
      where.city = { contains: filters.city, mode: 'insensitive' }
    }
    if (filters.state) {
      where.state = filters.state
    }

    // Property specs
    if (filters.propertyType && filters.propertyType.length > 0) {
      where.type = { in: filters.propertyType }
    }
    if (filters.bedrooms !== undefined) {
      where.bedrooms = { gte: filters.bedrooms }
    }
    if (filters.bathrooms !== undefined) {
      where.bathrooms = { gte: filters.bathrooms }
    }

    // Guests capacity
    if (filters.adults || filters.children) {
      const totalGuests = (filters.adults || 0) + (filters.children || 0)
      where.maxGuests = { gte: totalGuests }
    }

    // Price range
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      where.basePrice = {}
      if (filters.minPrice !== undefined) where.basePrice.gte = filters.minPrice
      if (filters.maxPrice !== undefined) where.basePrice.lte = filters.maxPrice
    }

    // Rating filter
    if (filters.minRating) {
      where.averageRating = { gte: filters.minRating }
    }

    // Super host filter
    if (filters.superHost) {
      where.host = {
        hostProfile: {
          isSuperHost: true
        }
      }
    }

    // Instant book filter
    if (filters.instantBook) {
      where.instantBook = true
    }

    // Amenities filter
    if (filters.amenities && filters.amenities.length > 0) {
      where.amenities = {
        some: {
          amenity: {
            name: { in: filters.amenities }
          }
        }
      }
    }

    return where
  }

  // Build order by clause
  private buildOrderBy(sortBy?: string): any {
    switch (sortBy) {
      case 'price-asc':
        return { basePrice: 'asc' }
      case 'price-desc':
        return { basePrice: 'desc' }
      case 'rating':
        return [{ averageRating: 'desc' }, { reviewCount: 'desc' }]
      case 'distance':
        // Would need PostGIS for proper distance sorting
        return { createdAt: 'desc' }
      case 'relevance':
      default:
        return [
          { averageRating: 'desc' },
          { reviewCount: 'desc' },
          { totalBookings: 'desc' }
        ]
    }
  }

  // Check availability for date ranges
  private async enrichWithAvailability(properties: any[], filters: SearchFilters): Promise<any[]> {
    if (!filters.checkIn || !filters.checkOut) {
      return properties
    }

    const propertyIds = properties.map(p => p.id)
    const nights = Math.ceil((filters.checkOut!.getTime() - filters.checkIn!.getTime()) / (1000 * 60 * 60 * 24))

    // Check for blocked dates
    const blockedDates = await prisma.propertyAvailability.findMany({
      where: {
        propertyId: { in: propertyIds },
        date: {
          gte: filters.checkIn,
          lt: filters.checkOut
        },
        isBlocked: true
      },
      select: { propertyId: true }
    })

    // Check for conflicting bookings
    const conflictingBookings = await prisma.booking.findMany({
      where: {
        propertyId: { in: propertyIds },
        status: { in: ['CONFIRMED', 'IN_PROGRESS'] },
        OR: [
          {
            AND: [
              { checkIn: { lte: filters.checkIn } },
              { checkOut: { gt: filters.checkIn } }
            ]
          },
          {
            AND: [
              { checkIn: { lt: filters.checkOut } },
              { checkOut: { gte: filters.checkOut } }
            ]
          },
          {
            AND: [
              { checkIn: { gte: filters.checkIn } },
              { checkOut: { lte: filters.checkOut } }
            ]
          }
        ]
      },
      select: { propertyId: true }
    })

    const unavailablePropertyIds = new Set([
      ...blockedDates.map(d => d.propertyId),
      ...conflictingBookings.map(b => b.propertyId)
    ])

    return properties.map(property => ({
      ...property,
      availability: {
        available: !unavailablePropertyIds.has(property.id),
        nights,
        totalPrice: unavailablePropertyIds.has(property.id) ? null :
          (property.basePrice * nights) + property.cleaningFee + (property.basePrice * nights * 0.1) // Service fee
      }
    })).filter(property => 
      // If dates are provided, only return available properties
      filters.checkIn && filters.checkOut ? property.availability.available : true
    )
  }

  // Calculate distances from search center
  private calculateDistances(properties: any[], filters: SearchFilters): any[] {
    if (!filters.latitude || !filters.longitude) {
      return properties
    }

    return properties.map(property => {
      if (property.latitude && property.longitude) {
        const distance = this.calculateHaversineDistance(
          filters.latitude!,
          filters.longitude!,
          property.latitude,
          property.longitude
        )
        return { ...property, distance: Math.round(distance * 100) / 100 }
      }
      return property
    }).filter(property => 
      // Filter by radius if specified
      filters.radius ? (property.distance || 0) <= filters.radius : true
    ).sort((a, b) => {
      // Sort by distance if distance sort is specified
      if (filters.sortBy === 'distance') {
        return (a.distance || Infinity) - (b.distance || Infinity)
      }
      return 0
    })
  }

  // Calculate distance using Haversine formula
  private calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371 // Earth's radius in km
    const dLat = this.deg2rad(lat2 - lat1)
    const dLon = this.deg2rad(lon2 - lon1)
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI/180)
  }

  // Get search facets for filtering
  private async getSearchFacets(whereClause: any): Promise<any> {
    const [priceRanges, propertyTypes, topCities, topAmenities] = await Promise.all([
      this.getPriceRangeFacets(whereClause),
      this.getPropertyTypeFacets(whereClause),
      this.getCityFacets(whereClause),
      this.getAmenityFacets(whereClause)
    ])

    return {
      priceRanges,
      propertyTypes,
      cities: topCities,
      amenities: topAmenities
    }
  }

  private async getPriceRangeFacets(whereClause: any) {
    const properties = await prisma.property.findMany({
      where: whereClause,
      select: { basePrice: true }
    })

    const prices = properties.map(p => p.basePrice)
    
    return [
      { range: 'R$ 0-100', count: prices.filter(p => p < 100).length },
      { range: 'R$ 100-200', count: prices.filter(p => p >= 100 && p < 200).length },
      { range: 'R$ 200-300', count: prices.filter(p => p >= 200 && p < 300).length },
      { range: 'R$ 300-500', count: prices.filter(p => p >= 300 && p < 500).length },
      { range: 'R$ 500+', count: prices.filter(p => p >= 500).length },
    ].filter(range => range.count > 0)
  }

  private async getPropertyTypeFacets(whereClause: any) {
    return await prisma.property.groupBy({
      by: ['type'],
      _count: { id: true },
      where: whereClause,
      orderBy: { _count: { id: 'desc' } },
      take: 10
    }).then(results => 
      results.map(r => ({ type: r.type, count: r._count.id }))
    )
  }

  private async getCityFacets(whereClause: any) {
    return await prisma.property.groupBy({
      by: ['city', 'state'],
      _count: { id: true },
      where: whereClause,
      orderBy: { _count: { id: 'desc' } },
      take: 15
    }).then(results => 
      results.map(r => ({ city: `${r.city}, ${r.state}`, count: r._count.id }))
    )
  }

  private async getAmenityFacets(whereClause: any) {
    const amenities = await prisma.propertyAmenity.groupBy({
      by: ['amenityId'],
      _count: { amenityId: true },
      where: {
        property: whereClause
      },
      orderBy: { _count: { amenityId: 'desc' } },
      take: 20
    })

    const amenityDetails = await prisma.amenity.findMany({
      where: { id: { in: amenities.map(a => a.amenityId) } },
      select: { id: true, name: true, icon: true }
    })

    return amenities.map(a => {
      const amenity = amenityDetails.find(d => d.id === a.amenityId)
      return {
        amenity: amenity?.name || 'Unknown',
        count: a._count.amenityId
      }
    })
  }

  // Get search suggestions
  private async getSearchSuggestions(query: string): Promise<string[]> {
    if (!query || query.length < 2) return []

    const [cities, neighborhoods, properties] = await Promise.all([
      // City suggestions
      prisma.property.groupBy({
        by: ['city', 'state'],
        _count: { id: true },
        where: {
          OR: [
            { city: { contains: query, mode: 'insensitive' } },
            { state: { contains: query, mode: 'insensitive' } }
          ],
          status: 'ACTIVE'
        },
        orderBy: { _count: { id: 'desc' } },
        take: 5
      }),
      // Neighborhood suggestions
      prisma.property.groupBy({
        by: ['neighborhood'],
        _count: { id: true },
        where: {
          neighborhood: { contains: query, mode: 'insensitive' },
          status: 'ACTIVE'
        },
        orderBy: { _count: { id: 'desc' } },
        take: 3
      }),
      // Property title suggestions
      prisma.property.findMany({
        where: {
          title: { contains: query, mode: 'insensitive' },
          status: 'ACTIVE'
        },
        select: { title: true },
        take: 3
      })
    ])

    const suggestions = [
      ...cities.map(c => `${c.city}, ${c.state}`),
      ...neighborhoods.map(n => n.neighborhood),
      ...properties.map(p => p.title)
    ]

    return [...new Set(suggestions)] // Remove duplicates
  }

  // Format search result
  private formatSearchResult(property: any, filters: SearchFilters): SearchResult {
    return {
      id: property.id,
      title: property.title,
      description: property.description.substring(0, 200) + '...',
      type: property.type,
      city: property.city,
      state: property.state,
      neighborhood: property.neighborhood,
      basePrice: property.basePrice,
      cleaningFee: property.cleaningFee,
      serviceFee: property.serviceFee,
      averageRating: property.averageRating,
      reviewCount: property._count.reviews,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      beds: property.beds,
      maxGuests: property.maxGuests,
      images: property.images,
      host: {
        id: property.host.id,
        name: property.host.name,
        avatar: property.host.avatar,
        isSuperHost: property.host.hostProfile?.isSuperHost || false,
        responseRate: property.host.hostProfile?.responseRate || 0
      },
      amenities: property.amenities.map((pa: any) => pa.amenity.name),
      distance: property.distance,
      instantBook: property.instantBook,
      availability: property.availability,
      relevanceScore: this.calculateRelevanceScore(property, filters)
    }
  }

  // Calculate relevance score
  private calculateRelevanceScore(property: any, filters: SearchFilters): number {
    let score = 0

    // Base score from ratings and reviews
    score += property.averageRating * 10
    score += Math.log(property._count.reviews + 1) * 5

    // Super host bonus
    if (property.host.hostProfile?.isSuperHost) {
      score += 15
    }

    // Recent booking activity bonus
    if (property.totalBookings > 0) {
      score += Math.log(property.totalBookings + 1) * 3
    }

    // Location match bonus
    if (filters.query) {
      const queryLower = filters.query.toLowerCase()
      if (property.city.toLowerCase().includes(queryLower)) score += 20
      if (property.neighborhood.toLowerCase().includes(queryLower)) score += 15
      if (property.title.toLowerCase().includes(queryLower)) score += 10
    }

    // Price competitiveness (middle range gets bonus)
    if (filters.minPrice && filters.maxPrice) {
      const priceRange = filters.maxPrice - filters.minPrice
      const pricePosition = (property.basePrice - filters.minPrice) / priceRange
      if (pricePosition >= 0.3 && pricePosition <= 0.7) {
        score += 10
      }
    }

    return Math.round(score)
  }

  // Save search log for analytics
  async logSearch(filters: SearchFilters, resultCount: number, userId?: string): Promise<void> {
    try {
      await prisma.searchLog.create({
        data: {
          userId,
          query: filters.query,
          filters: filters,
          resultCount,
          createdAt: new Date()
        }
      })
    } catch (error) {
      console.error('Failed to log search:', error)
    }
  }
}
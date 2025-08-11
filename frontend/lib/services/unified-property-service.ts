// Unified Property Service - Orchestrates Local + LiteAPI
// This service provides a single interface for both property sources

import { 
  UnifiedProperty, 
  UnifiedBooking, 
  PropertyAvailability, 
  SearchFilters, 
  SearchResponse,
  PropertySource,
  PropertyType,
  PropertyStatus,
  ApiResponse,
  PaginatedResponse
} from '../database/schemas'

import { liteApiService, LiteApiUtils } from './liteapi'
import { cacheService, Cached } from '../cache/cache-service'
import { localPropertyService } from './local-property-service'

export class UnifiedPropertyService {
  private localService = localPropertyService
  private liteApiService = liteApiService
  private pendingRequests = new Map<string, Promise<SearchResponse>>()

  constructor() {
    // Initialize cache service
    cacheService.initialize()
  }

  // Generate a consistent key for request deduplication
  private getRequestKey(filters: SearchFilters): string {
    const normalizeDate = (date: Date | string | undefined) => {
      if (!date) return ''
      const d = typeof date === 'string' ? new Date(date) : date
      return d.toISOString().split('T')[0]
    }
    
    return JSON.stringify({
      destination: filters.destination || '',
      checkIn: normalizeDate(filters.checkIn),
      checkOut: normalizeDate(filters.checkOut),
      adults: filters.adults,
      children: filters.children,
      page: filters.page,
      limit: filters.limit,
      includeLocal: filters.includeLocal,
      includeLiteApi: filters.includeLiteApi
    })
  }

  // Main search method that combines both sources
  async searchProperties(filters: SearchFilters): Promise<SearchResponse> {
    const startTime = Date.now()
    const searchId = `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Deduplicate concurrent requests
    const requestKey = this.getRequestKey(filters)
    if (this.pendingRequests.has(requestKey)) {
      console.log(`♻️ Reusing pending request for: ${filters.destination}`)
      return this.pendingRequests.get(requestKey)!
    }
    
    // Create new search promise
    const searchPromise = this.performSearch(filters, startTime, searchId)
    this.pendingRequests.set(requestKey, searchPromise)
    
    // Clean up after completion
    searchPromise.finally(() => {
      setTimeout(() => this.pendingRequests.delete(requestKey), 100)
    })
    
    return searchPromise
  }
  
  private async performSearch(
    filters: SearchFilters, 
    startTime: number, 
    searchId: string
  ): Promise<SearchResponse> {
    console.log(`🔍 Starting unified search: ${JSON.stringify(filters)}`)

    // Check cache first
    const cachedResults = await cacheService.getCachedSearchResults(filters)
    if (cachedResults) {
      console.log(`🎯 Returning cached search results (${cachedResults.length} properties)`)
      
      return {
        properties: cachedResults,
        totalCount: cachedResults.length,
        page: filters.page,
        totalPages: Math.ceil(cachedResults.length / filters.limit),
        hasNext: false,
        searchTime: Date.now() - startTime,
        localResults: cachedResults.filter(p => p.source === PropertySource.LOCAL).length,
        liteApiResults: cachedResults.filter(p => p.source === PropertySource.LITEAPI).length,
        appliedFilters: filters,
        searchId,
        timestamp: new Date()
      }
    }

    // Parallel search from both sources
    const promises = []
    let searchLocalProperties = true
    let searchLiteApiProperties = true

    // Check source preferences
    if (filters.sources?.length) {
      searchLocalProperties = filters.sources.includes(PropertySource.LOCAL)
      searchLiteApiProperties = filters.sources.includes(PropertySource.LITEAPI)
    }

    // Override with specific flags if provided
    if (filters.includeLocal !== undefined) {
      searchLocalProperties = filters.includeLocal
    }
    if (filters.includeLiteApi !== undefined) {
      searchLiteApiProperties = filters.includeLiteApi
    }

    // Launch parallel searches
    if (searchLocalProperties) {
      console.log('🏠 Searching local properties...')
      promises.push(
        this.localService.searchProperties(filters)
          .then(results => ({ source: PropertySource.LOCAL, results, error: null }))
          .catch(error => ({ source: PropertySource.LOCAL, results: [], error }))
      )
    }

    if (searchLiteApiProperties) {
      console.log('🌐 Searching LiteAPI properties...')
      promises.push(
        this.liteApiService.searchHotels(filters)
          .then(results => ({ source: PropertySource.LITEAPI, results, error: null }))
          .catch(error => ({ source: PropertySource.LITEAPI, results: [], error }))
      )
    }

    // Wait for all searches to complete
    const searchResults = await Promise.all(promises)
    
    // Process results
    let allProperties: UnifiedProperty[] = []
    let localResults = 0
    let liteApiResults = 0
    let errors = []

    for (const result of searchResults) {
      if (result.error) {
        console.error(`❌ Search failed for ${result.source}:`, result.error)
        errors.push({ source: result.source, error: result.error })
      } else {
        allProperties = allProperties.concat(result.results)
        
        if (result.source === PropertySource.LOCAL) {
          localResults = result.results.length
        } else {
          liteApiResults = result.results.length
        }
      }
    }

    // Apply unified sorting and filtering
    allProperties = this.applySorting(allProperties, filters.sortBy, filters.sortOrder)
    
    // Apply pagination
    const startIndex = (filters.page - 1) * filters.limit
    const endIndex = startIndex + filters.limit
    const paginatedProperties = allProperties.slice(startIndex, endIndex)

    // Cache the results (before pagination for better cache utilization)
    if (allProperties.length > 0) {
      await cacheService.cacheSearchResults(filters, allProperties)
    }

    // Track API usage
    if (searchLiteApiProperties && liteApiResults > 0) {
      await cacheService.incrementApiUsage(PropertySource.LITEAPI)
    }

    const response: SearchResponse = {
      properties: paginatedProperties,
      totalCount: allProperties.length,
      page: filters.page,
      totalPages: Math.ceil(allProperties.length / filters.limit),
      hasNext: endIndex < allProperties.length,
      searchTime: Date.now() - startTime,
      localResults,
      liteApiResults,
      appliedFilters: filters,
      searchId,
      timestamp: new Date()
    }

    console.log(`✅ Search completed: ${response.properties.length}/${response.totalCount} properties (${response.searchTime}ms)`)
    
    return response
  }

  // Get property details (tries cache first, then appropriate source)
  async getPropertyDetails(propertyId: string): Promise<UnifiedProperty | null> {
    console.log(`🏨 Getting property details: ${propertyId}`)

    // Check cache first
    const cached = await cacheService.getCachedProperty(propertyId)
    if (cached) {
      console.log(`🎯 Property cache hit: ${propertyId}`)
      return cached
    }

    // Determine source from ID
    const isLiteApi = propertyId.startsWith('liteapi_')
    const isLocal = propertyId.startsWith('local_')

    let property: UnifiedProperty | null = null

    if (isLiteApi) {
      const liteApiId = propertyId.replace('liteapi_', '')
      property = await this.liteApiService.getHotelDetails(liteApiId)
    } else if (isLocal) {
      property = await this.localService.getProperty(propertyId)
    } else {
      // Try both sources if ID format is ambiguous
      console.log(`⚠️ Ambiguous property ID format: ${propertyId}, trying both sources`)
      
      const [localResult, liteApiResult] = await Promise.allSettled([
        this.localService.getProperty(propertyId),
        this.liteApiService.getHotelDetails(propertyId)
      ])

      if (localResult.status === 'fulfilled' && localResult.value) {
        property = localResult.value
      } else if (liteApiResult.status === 'fulfilled' && liteApiResult.value) {
        property = liteApiResult.value
      }
    }

    // Cache the result if found
    if (property) {
      await cacheService.cacheProperty(property)
    }

    return property
  }

  // Get availability and rates
  async getPropertyAvailability(
    propertyId: string,
    checkIn: Date,
    checkOut: Date,
    adults: number = 2,
    children: number = 0
  ): Promise<PropertyAvailability[]> {
    console.log(`📅 Getting availability: ${propertyId} (${checkIn.toDateString()} - ${checkOut.toDateString()})`)

    // Check cache first
    const cached = await cacheService.getCachedAvailability(propertyId, checkIn)
    if (cached) {
      console.log(`🎯 Availability cache hit: ${propertyId}`)
      return cached
    }

    let availability: PropertyAvailability[] = []

    // Determine source and get availability
    if (propertyId.startsWith('liteapi_')) {
      const liteApiId = propertyId.replace('liteapi_', '')
      availability = await this.liteApiService.getAvailableRates(liteApiId, checkIn, checkOut, adults, children)
    } else {
      availability = await this.localService.getAvailability(propertyId, checkIn, checkOut)
    }

    // Cache the results
    if (availability.length > 0) {
      await cacheService.cacheAvailability(propertyId, availability)
    }

    return availability
  }

  // Create booking (routes to appropriate service)
  async createBooking(bookingData: {
    propertyId: string
    checkIn: Date
    checkOut: Date
    guests: { adults: number; children: number }
    guestInfo: {
      name: string
      email: string
      phone: string
      cpf?: string
    }
    paymentMethod: 'pix' | 'credit_card'
    specialRequests?: string
    rateId?: string // For LiteAPI bookings
  }): Promise<UnifiedBooking | null> {
    console.log(`💳 Creating booking: ${bookingData.propertyId}`)

    if (bookingData.propertyId.startsWith('liteapi_')) {
      // LiteAPI booking flow
      if (!bookingData.rateId) {
        console.error('❌ Rate ID required for LiteAPI bookings')
        return null
      }

      // Step 1: Prebook
      const prebook = await this.liteApiService.prebook({
        rateId: bookingData.rateId,
        checkIn: bookingData.checkIn,
        checkOut: bookingData.checkOut,
        guests: [
          { type: 'adult', firstName: bookingData.guestInfo.name.split(' ')[0], lastName: bookingData.guestInfo.name.split(' ').slice(1).join(' ') }
        ],
        contactEmail: bookingData.guestInfo.email,
        contactPhone: bookingData.guestInfo.phone
      })

      if (!prebook) {
        console.error('❌ Prebooking failed')
        return null
      }

      // Step 2: Complete booking (after payment confirmation)
      return await this.liteApiService.completeBooking(prebook.prebookId)
      
    } else {
      // Local property booking
      return await this.localService.createBooking(bookingData)
    }
  }

  // Cancel booking
  async cancelBooking(bookingId: string): Promise<boolean> {
    console.log(`❌ Cancelling booking: ${bookingId}`)

    if (bookingId.startsWith('liteapi_')) {
      const liteApiBookingId = bookingId.replace('liteapi_', '')
      return await this.liteApiService.cancelBooking(liteApiBookingId)
    } else {
      // Local booking cancellation logic
      return false // Placeholder
    }
  }

  // Get booking details
  async getBookingDetails(bookingId: string): Promise<UnifiedBooking | null> {
    console.log(`📋 Getting booking details: ${bookingId}`)

    if (bookingId.startsWith('liteapi_')) {
      const liteApiBookingId = bookingId.replace('liteapi_', '')
      return await this.liteApiService.getBookingDetails(liteApiBookingId)
    } else {
      // Local booking details logic
      return null // Placeholder
    }
  }

  // Get popular destinations (with caching)
  async getPopularDestinations(): Promise<Array<{
    name: string
    state: string
    country: string
    image: string
    propertyCount: number
    averagePrice: number
    trending: boolean
  }>> {
    // This would typically aggregate data from both sources
    return [
      {
        name: 'Rio de Janeiro',
        state: 'RJ',
        country: 'Brasil',
        image: 'https://images.unsplash.com/photo-1544989164-7bb8803a8726?w=500',
        propertyCount: 2847,
        averagePrice: 180,
        trending: true
      },
      {
        name: 'São Paulo',
        state: 'SP', 
        country: 'Brasil',
        image: 'https://images.unsplash.com/photo-1541707338078-b6c78263d9bb?w=500',
        propertyCount: 1923,
        averagePrice: 150,
        trending: false
      },
      // Add more destinations...
    ]
  }

  // Performance and analytics methods

  // Get service health status
  async getHealthStatus(): Promise<{
    overall: 'healthy' | 'degraded' | 'down'
    local: boolean
    liteApi: boolean
    cache: any
    lastUpdated: Date
  }> {
    const [liteApiHealth, cacheStats] = await Promise.all([
      this.liteApiService.healthCheck(),
      cacheService.getStats()
    ])

    const localHealth = true // Would check database connection

    return {
      overall: (localHealth && liteApiHealth) ? 'healthy' : 'degraded',
      local: localHealth,
      liteApi: liteApiHealth,
      cache: cacheStats,
      lastUpdated: new Date()
    }
  }

  // Get API usage statistics
  async getUsageStats(): Promise<{
    local: { requestsToday: number; responseTime: number }
    liteApi: { requestsToday: number; responseTime: number; remainingQuota: number }
    cache: { hitRate: number; size: number }
  }> {
    const [localUsage, liteApiUsage, liteApiStats, cacheStats] = await Promise.all([
      cacheService.getApiUsage(PropertySource.LOCAL),
      cacheService.getApiUsage(PropertySource.LITEAPI),
      this.liteApiService.getUsageStats(),
      cacheService.getStats()
    ])

    return {
      local: {
        requestsToday: localUsage,
        responseTime: 45 // Would be measured
      },
      liteApi: {
        requestsToday: liteApiUsage,
        responseTime: 1200, // Would be measured
        remainingQuota: liteApiStats?.remainingQuota || 0
      },
      cache: {
        hitRate: cacheStats.performance.hitRate,
        size: cacheStats.performance.cacheSize
      }
    }
  }

  // Warm up cache for popular searches
  async warmUpCache(): Promise<void> {
    console.log('🔥 Starting cache warm-up...')
    
    const popularSearches = [
      { destination: 'Rio de Janeiro', checkIn: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), checkOut: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), adults: 2, children: 0 },
      { destination: 'São Paulo', checkIn: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), checkOut: new Date(Date.now() + 17 * 24 * 60 * 60 * 1000), adults: 2, children: 0 },
    ]

    for (const search of popularSearches) {
      const filters: SearchFilters = {
        destination: search.destination,
        checkIn: search.checkIn,
        checkOut: search.checkOut,
        adults: search.adults,
        children: search.children,
        infants: 0,
        page: 1,
        limit: 20,
        currency: 'BRL'
      }

      // Trigger background search to populate cache
      this.searchProperties(filters).catch(error => {
        console.error(`❌ Failed to warm cache for ${search.destination}:`, error)
      })
    }
  }

  // Private helper methods
  private applySorting(
    properties: UnifiedProperty[], 
    sortBy?: string, 
    sortOrder: 'asc' | 'desc' = 'asc'
  ): UnifiedProperty[] {
    if (!sortBy) return properties

    const sorted = [...properties].sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (sortBy) {
        case 'price':
          aValue = a.basePricePerNight
          bValue = b.basePricePerNight
          break
        case 'rating':
          aValue = a.rating
          bValue = b.rating
          break
        case 'popularity':
          aValue = a.reviewCount
          bValue = b.reviewCount
          break
        case 'distance':
          // Would calculate distance from search center
          aValue = 0
          bValue = 0
          break
        default:
          return 0
      }

      if (sortOrder === 'asc') {
        return aValue - bValue
      } else {
        return bValue - aValue
      }
    })

    return sorted
  }

  // Apply dynamic pricing markup for LiteAPI properties
  private applyDynamicMarkup(property: UnifiedProperty): UnifiedProperty {
    if (property.source !== PropertySource.LITEAPI) {
      return property
    }

    // Calculate dynamic markup based on various factors
    const baseMarkup = property.liteApiData?.supplierMarkup || 15
    const factors = {
      demand: 'medium' as const, // Would be calculated from search volume
      season: 'low' as const, // Would be determined from date
      competition: 0.3, // Would be calculated from competitive analysis
      propertyRating: property.rating
    }

    const dynamicMarkup = LiteApiUtils.calculateDynamicMarkup(baseMarkup, factors)
    
    // Apply the new markup
    const originalPrice = property.basePricePerNight
    const newPrice = Math.round(originalPrice * (1 + dynamicMarkup / 100))

    return {
      ...property,
      basePricePerNight: newPrice,
      liteApiData: property.liteApiData ? {
        ...property.liteApiData,
        supplierMarkup: dynamicMarkup
      } : undefined
    }
  }
}

// Singleton instance
export const unifiedPropertyService = new UnifiedPropertyService()

// Utility functions for the frontend
export const PropertyServiceUtils = {
  // Format property for display
  formatPropertyForDisplay(property: UnifiedProperty) {
    return {
      ...property,
      priceFormatted: LiteApiUtils.formatPrice(property.basePricePerNight, property.currency),
      isLocal: property.source === PropertySource.LOCAL,
      isLiteApi: property.source === PropertySource.LITEAPI,
      sourceLabel: property.source === PropertySource.LOCAL ? 'Anfitrião Local' : 'Hotel Verificado',
      trustBadge: property.source === PropertySource.LOCAL ? 'HospedeFácil Verificado' : 'Parceiro Global'
    }
  },

  // Calculate booking fee structure
  calculateBookingFees(
    basePrice: number, 
    nights: number, 
    source: PropertySource,
    paymentMethod: 'pix' | 'credit_card'
  ) {
    const subtotal = basePrice * nights
    let serviceFee = 0
    let cleaningFee = 0
    let discount = 0

    if (source === PropertySource.LOCAL) {
      // Local properties: no service fees, but we take commission from host
      serviceFee = 0
      cleaningFee = 0
    } else {
      // LiteAPI properties: our markup is built into the price
      serviceFee = 0
      cleaningFee = 0
    }

    // PIX discount
    if (paymentMethod === 'pix') {
      discount = subtotal * 0.03 // 3% PIX discount
    }

    const total = subtotal + serviceFee + cleaningFee - discount

    return {
      subtotal,
      serviceFee,
      cleaningFee,
      discount,
      total,
      currency: 'BRL'
    }
  },

  // Check if property supports instant booking
  supportsInstantBooking(property: UnifiedProperty): boolean {
    if (property.source === PropertySource.LOCAL) {
      return property.isInstantBookable
    } else {
      // Most LiteAPI properties support instant booking
      return true
    }
  },

  // Get cancellation policy summary
  getCancellationSummary(property: UnifiedProperty, checkIn: Date): string {
    if (!property.cancellationPolicy?.rules?.length) {
      return 'Política de cancelamento não especificada'
    }

    const isRefundable = LiteApiUtils.isRefundable(property.cancellationPolicy, checkIn)
    
    if (isRefundable) {
      const rule = property.cancellationPolicy.rules[0]
      return `Cancelamento gratuito até ${rule.beforeHours}h antes do check-in`
    } else {
      return 'Cancelamento com taxas aplicáveis'
    }
  }
}
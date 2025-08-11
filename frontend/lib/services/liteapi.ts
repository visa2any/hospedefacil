// LiteAPI Integration Service
// Documentation: https://dashboard.liteapi.travel/documentation/

import { 
  UnifiedProperty, 
  UnifiedBooking, 
  PropertyAvailability, 
  SearchFilters, 
  PropertySource,
  PropertyType,
  PropertyStatus,
  BookingStatus,
  LiteApiPropertyData,
  LiteApiBookingData,
  ApiResponse
} from '../database/schemas'

// LiteAPI Configuration
const LITEAPI_CONFIG = {
  BASE_URL: 'https://api.liteapi.travel',
  API_VERSION: 'v3.0',
  TIMEOUT: 15000, // 15 seconds - reduced to prevent user aborts
  MAX_RETRIES: 2, // Reduced retries for better UX
  RATE_LIMIT: 5000, // requests per hour
}

// LiteAPI Native Types (as per their documentation)
interface LiteApiHotel {
  id: string
  name: string
  hotelDescription?: string
  hotelImportantInformation?: string
  latitude?: number
  longitude?: number
  location?: {
    latitude: number
    longitude: number
  }
  address: string
  city: string
  state?: string
  country?: string
  zip?: string
  postal_code?: string
  phone?: string
  email?: string
  website?: string
  description?: string
  main_photo?: string
  thumbnail?: string
  hotelImages?: Array<{
    url: string
    urlHd?: string
    caption?: string
    order?: number
    defaultImage?: boolean
  }>
  images?: LiteApiImage[]
  hotelFacilities?: string[]
  amenities?: LiteApiAmenity[]
  rooms?: LiteApiRoom[]
  policies?: LiteApiPolicies
  checkinCheckoutTimes?: {
    checkin: string
    checkout: string
    checkinStart?: string
  }
  rating?: number
  starRating?: number
  review_count?: number
  chainId?: string
  chain?: string
  chain_id?: string
  chain_name?: string
  property_type?: string
  star_rating?: number
}

interface LiteApiImage {
  url: string
  title?: string
  width?: number
  height?: number
  type: 'room' | 'hotel' | 'amenity' | 'other'
}

interface LiteApiAmenity {
  id: string
  name: string
  category: string
}

interface LiteApiRoom {
  id?: string
  roomName?: string
  name?: string
  description?: string
  maxOccupancy?: number
  max_occupancy?: number
  roomSizeSquare?: number
  roomSizeUnit?: 'sqm' | 'sqft' | 'm2'
  size?: number
  size_unit?: 'sqm' | 'sqft'
  bedTypes?: Array<{
    quantity: number
    bedType: string
    bedSize?: string
  }>
  bed_configurations?: LiteApiBedConfig[]
  roomAmenities?: Array<{
    amenitiesId: number
    name: string
  }>
  amenities?: string[]
  photos?: Array<{
    url: string
    hd_url?: string
    imageDescription?: string
    mainPhoto?: boolean
  }>
  images?: LiteApiImage[]
}

interface LiteApiBedConfig {
  type: string
  count: number
}

interface LiteApiPolicies {
  check_in: {
    from: string
    to: string
  }
  check_out: {
    from: string
    to: string
  }
  cancellation: {
    type: string
    description: string
    rules: Array<{
      hours_before: number
      penalty_percentage: number
    }>
  }
  child_policy?: string
  pet_policy?: string
}

interface LiteApiRate {
  room_id: string
  rate_id: string
  room_name: string
  booking_conditions: {
    refundable: boolean
    breakfast_included: boolean
    wifi_included: boolean
  }
  price: {
    base: number
    taxes: number
    fees: number
    total: number
    currency: string
  }
  supplier: {
    name: string
    confirmation_type: 'instant' | 'on_request'
  }
}

interface LiteApiBookingRequest {
  rate_id: string
  checkin: string
  checkout: string
  guests: Array<{
    type: 'adult' | 'child'
    age?: number
    first_name: string
    last_name: string
  }>
  contact: {
    email: string
    phone: string
  }
  special_requests?: string
}

interface LiteApiBookingResponse {
  booking_id: string
  confirmation_number: string
  status: 'confirmed' | 'on_request' | 'failed'
  hotel: LiteApiHotel
  room: LiteApiRoom
  price: {
    base: number
    taxes: number
    fees: number
    total: number
    currency: string
  }
  guest_details: any
  cancellation_policy: any
  supplier_info: any
}

export class LiteApiService {
  private apiKey: string
  private baseUrl: string
  private timeout: number

  constructor() {
    this.apiKey = process.env.LITEAPI_KEY || ''
    this.baseUrl = LITEAPI_CONFIG.BASE_URL
    this.timeout = LITEAPI_CONFIG.TIMEOUT

    if (!this.apiKey) {
      console.warn('⚠️  LiteAPI key not configured. Set LITEAPI_KEY environment variable.')
    }
  }

  // Private HTTP client with retry logic
  private async makeRequest<T>(
    endpoint: string, 
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: any,
    retryCount = 0
  ): Promise<T> {
    const url = `${this.baseUrl}/${LITEAPI_CONFIG.API_VERSION}/${endpoint}`
    
    const headers: Record<string, string> = {
      'X-API-Key': this.apiKey,
      'Content-Type': 'application/json',
      'User-Agent': 'HospedeFacil/1.0'
    }

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.timeout)

      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        if (response.status === 429 && retryCount < LITEAPI_CONFIG.MAX_RETRIES) {
          // Rate limit hit, wait and retry
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000))
          return this.makeRequest(endpoint, method, body, retryCount + 1)
        }
        
        throw new Error(`LiteAPI Error: ${response.status} - ${response.statusText}`)
      }

      const data = await response.json()
      return data
    } catch (error) {
      if (retryCount < LITEAPI_CONFIG.MAX_RETRIES) {
        console.log(`🔄 Retrying LiteAPI request... (${retryCount + 1}/${LITEAPI_CONFIG.MAX_RETRIES})`)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000))
        return this.makeRequest(endpoint, method, body, retryCount + 1)
      }
      
      console.error('❌ LiteAPI Request Failed:', error)
      throw error
    }
  }

  // Search Hotels by Location
  async searchHotels(filters: SearchFilters): Promise<UnifiedProperty[]> {
    try {
      const searchParams = {
        checkin: filters.checkIn?.toISOString().split('T')[0],
        checkout: filters.checkOut?.toISOString().split('T')[0],
        currency: filters.currency || 'BRL',
        guestNationality: 'BR',
        occupancies: [{
          adults: filters.adults || 2,
          children: Array(filters.children || 0).fill(0).map((_, i) => 10) // Default children age to 10
        }],
        // Location specification - properly format Brazilian city names
        ...(filters.destination ? {
          cityName: this.normalizeCityName(filters.destination),
          countryCode: 'BR',
          // Add state code for better matching
          ...(this.getCityStateCode(filters.destination) ? { 
            stateCode: this.getCityStateCode(filters.destination) 
          } : {})
        } : {}),
        ...(filters.coordinates ? { 
          longitude: filters.coordinates.lng, 
          latitude: filters.coordinates.lat,
          radius: 10 // 10km radius
        } : {}),
        limit: Math.min(filters.limit || 50, 200) // LiteAPI max 200 per request
      }

      console.log('🔍 LiteAPI Search Request:', JSON.stringify(searchParams, null, 2))

      const response = await this.makeRequest<{
        data: Array<{
          hotelId: string
          roomTypes: Array<{
            roomTypeId: string
            offerId: string
            rates: LiteApiRate[]
            offerRetailRate: { amount: number, currency: string }
            suggestedSellingPrice: { amount: number, currency: string }
            offerInitialPrice: { amount: number, currency: string }
          }>
        }>
      }>('hotels/rates', 'POST', searchParams)

      console.log(`🎯 LiteAPI Response: ${response.data?.length || 0} hotels found`)

      // Get hotel details for each hotelId found
      const hotels: UnifiedProperty[] = []
      if (response.data && Array.isArray(response.data)) {
        for (const hotelData of response.data.slice(0, filters.limit || 50)) {
          try {
            // Get detailed hotel information
            const hotelDetails = await this.getHotelDetails(hotelData.hotelId)
            if (hotelDetails && hotelData.roomTypes?.length > 0) {
              // Add rate information to the hotel
              const minRate = Math.min(...hotelData.roomTypes.map(rt => rt.offerRetailRate?.amount || 0))
              hotelDetails.basePricePerNight = minRate || hotelDetails.basePricePerNight
              hotels.push(hotelDetails)
            }
          } catch (error) {
            console.warn(`❌ Failed to get details for hotel ${hotelData.hotelId}:`, error)
          }
        }
      }

      return hotels
    } catch (error) {
      console.error('🔍 Hotel search failed:', error)
      return [] // Return empty array on error, don't break the search
    }
  }

  // Helper function to normalize city names for LiteAPI
  private normalizeCityName(cityName: string): string {
    // Remove accents and special characters
    const normalized = cityName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
    
    // Map common variations
    const cityMappings: Record<string, string> = {
      'São Paulo': 'Sao Paulo',
      'Florianópolis': 'Florianopolis',
      'Búzios': 'Armacao dos Buzios',
      'Salvador': 'Salvador',
      'Rio de Janeiro': 'Rio de Janeiro',
      'Brasília': 'Brasilia',
      'Belém': 'Belem',
      'São Luís': 'Sao Luis'
    }
    
    return cityMappings[cityName] || normalized
  }
  
  // Helper function to get state code for Brazilian cities
  private getCityStateCode(cityName: string): string | null {
    const cityStates: Record<string, string> = {
      'São Paulo': 'SP',
      'Rio de Janeiro': 'RJ',
      'Salvador': 'BA',
      'Florianópolis': 'SC',
      'Búzios': 'RJ',
      'Armacao dos Buzios': 'RJ',
      'Brasília': 'DF',
      'Belo Horizonte': 'MG',
      'Porto Alegre': 'RS',
      'Recife': 'PE',
      'Fortaleza': 'CE',
      'Manaus': 'AM',
      'Curitiba': 'PR',
      'Belém': 'PA',
      'Goiânia': 'GO',
      'Guarulhos': 'SP',
      'Campinas': 'SP',
      'São Luís': 'MA',
      'Maceió': 'AL',
      'Natal': 'RN',
      'Campo Grande': 'MS'
    }
    
    return cityStates[cityName] || cityStates[this.normalizeCityName(cityName)] || null
  }

  // Get Hotel Details by ID
  async getHotelDetails(hotelId: string): Promise<UnifiedProperty | null> {
    try {
      const hotel = await this.makeRequest<{data: LiteApiHotel}>(`data/hotel?hotelId=${hotelId}`)
      return this.transformLiteApiToUnified(hotel.data)
    } catch (error) {
      console.error(`🏨 Failed to get hotel details for ${hotelId}:`, error)
      return null
    }
  }

  // Get Available Rates for a Hotel
  async getAvailableRates(
    hotelId: string, 
    checkIn: Date, 
    checkOut: Date,
    adults: number = 2,
    children: number = 0
  ): Promise<PropertyAvailability[]> {
    try {
      const ratesParams = {
        hotelIds: [hotelId],
        checkin: checkIn.toISOString().split('T')[0],
        checkout: checkOut.toISOString().split('T')[0],
        currency: 'BRL',
        guestNationality: 'BR',
        occupancies: [{
          adults,
          children: Array(children).fill(0).map((_, i) => 10)
        }]
      }

      const response = await this.makeRequest<{
        data: Array<{
          hotelId: string
          roomTypes: Array<{
            roomTypeId: string
            offerId: string
            rates: LiteApiRate[]
            offerRetailRate: { amount: number, currency: string }
          }>
        }>
      }>('hotels/rates', 'POST', ratesParams)

      // Process the response data and convert to PropertyAvailability format
      const availabilities: PropertyAvailability[] = []
      
      if (response.data && Array.isArray(response.data)) {
        for (const hotelData of response.data) {
          for (const roomType of hotelData.roomTypes) {
            for (const rate of roomType.rates) {
              availabilities.push({
                propertyId: hotelId,
                source: PropertySource.LITEAPI,
                checkIn,
                checkOut,
                isAvailable: true,
                basePrice: rate.retailRate?.total?.[0]?.amount || roomType.offerRetailRate?.amount || 0,
                taxes: rate.retailRate?.taxesAndFees?.[0]?.amount || 0,
                fees: 0,
                discounts: 0,
                totalPrice: rate.retailRate?.total?.[0]?.amount || roomType.offerRetailRate?.amount || 0,
                currency: rate.retailRate?.total?.[0]?.currency || roomType.offerRetailRate?.currency || 'BRL',
                rateId: rate.rateId || `${hotelId}_${Date.now()}_${Math.random()}`,
                rateType: rate.cancellationPolicies?.refundableTag === 'RFN' ? 'standard' : 'non_refundable',
                rateDescription: rate.name,
                minimumStay: 1,
                freeCancellationUntil: rate.cancellationPolicies?.refundableTag === 'RFN' ? 
                  new Date(checkIn.getTime() - 24 * 60 * 60 * 1000) : undefined,
                cachedAt: new Date(),
                expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes cache
              })
            }
          }
        }
      }
      
      return availabilities
    } catch (error) {
      console.error(`💰 Failed to get rates for hotel ${hotelId}:`, error)
      return []
    }
  }

  // Pre-book (Step 1 of booking process)
  async prebook(bookingData: {
    rateId: string
    checkIn: Date
    checkOut: Date
    guests: Array<{ type: 'adult' | 'child'; firstName: string; lastName: string; age?: number }>
    contactEmail: string
    contactPhone: string
  }): Promise<{ prebookId: string; price: any; expiry: Date } | null> {
    try {
      const prebookRequest = {
        rate_id: bookingData.rateId,
        checkin: bookingData.checkIn.toISOString().split('T')[0],
        checkout: bookingData.checkOut.toISOString().split('T')[0],
        guests: bookingData.guests.map(guest => ({
          type: guest.type,
          age: guest.age,
          first_name: guest.firstName,
          last_name: guest.lastName
        })),
        contact: {
          email: bookingData.contactEmail,
          phone: bookingData.contactPhone
        }
      }

      const response = await this.makeRequest<{
        prebook_id: string
        rate: LiteApiRate
        expires_at: string
        supplier_confirmation_type: string
      }>('bookings/prebook', 'POST', prebookRequest)

      return {
        prebookId: response.prebook_id,
        price: response.rate.price,
        expiry: new Date(response.expires_at)
      }
    } catch (error) {
      console.error('📝 Prebooking failed:', error)
      return null
    }
  }

  // Complete Booking (Step 2)
  async completeBooking(prebookId: string): Promise<UnifiedBooking | null> {
    try {
      const response = await this.makeRequest<LiteApiBookingResponse>(
        `bookings/${prebookId}/confirm`, 
        'POST'
      )

      // Transform to unified booking format
      return this.transformLiteApiBookingToUnified(response)
    } catch (error) {
      console.error('✅ Booking confirmation failed:', error)
      return null
    }
  }

  // Cancel Booking
  async cancelBooking(bookingId: string): Promise<boolean> {
    try {
      await this.makeRequest(`bookings/${bookingId}/cancel`, 'POST')
      return true
    } catch (error) {
      console.error(`❌ Failed to cancel booking ${bookingId}:`, error)
      return false
    }
  }

  // Get Booking Details
  async getBookingDetails(bookingId: string): Promise<UnifiedBooking | null> {
    try {
      const response = await this.makeRequest<LiteApiBookingResponse>(`bookings/${bookingId}`)
      return this.transformLiteApiBookingToUnified(response)
    } catch (error) {
      console.error(`📋 Failed to get booking details for ${bookingId}:`, error)
      return null
    }
  }

  // Transform LiteAPI Hotel to Unified Property
  private transformLiteApiToUnified(hotel: LiteApiHotel, rates?: LiteApiRate[]): UnifiedProperty {
    try {
      console.log(`🔄 Transforming hotel ${hotel.id}: ${hotel.name}`)
      
      // Map property type
      const propertyTypeMap: Record<string, PropertyType> = {
        'hotel': PropertyType.HOTEL,
        'apartment': PropertyType.APARTMENT,
        'house': PropertyType.HOUSE,
        'resort': PropertyType.RESORT,
        'villa': PropertyType.VILLA
      }

      // Calculate accommodation details from rooms (safeguard against undefined)
      const rooms = Array.isArray(hotel.rooms) ? hotel.rooms : []
      console.log(`📊 Hotel ${hotel.id} has ${rooms.length} rooms`)
      
      let maxAccommodates = 2 // Default
      if (rooms.length > 0) {
        try {
          maxAccommodates = Math.max(...rooms.map(room => room.maxOccupancy || room.max_occupancy || 2))
        } catch (e) {
          console.warn(`⚠️  Error calculating max accommodates for hotel ${hotel.id}:`, e)
        }
      }
      
      let totalBedrooms = 1 // Default
      if (rooms.length > 0) {
        try {
          totalBedrooms = rooms.reduce((sum, room) => {
            // Handle both API formats
            const bedTypes = Array.isArray(room.bedTypes) ? room.bedTypes : 
                            Array.isArray(room.bed_configurations) ? room.bed_configurations : []
            const bedrooms = bedTypes.reduce((bedSum, bed) => {
              const bedType = bed.bedType || bed.type || ''
              const quantity = bed.quantity || bed.count || 1
              return bedSum + (bedType.toLowerCase().includes('king') || bedType.toLowerCase().includes('queen') ? quantity : 0)
            }, 0)
            return sum + Math.max(bedrooms, 1) // At least 1 bedroom per room
          }, 0)
        } catch (e) {
          console.warn(`⚠️  Error calculating bedrooms for hotel ${hotel.id}:`, e)
          totalBedrooms = 1
        }
      }

    // Extract base price from rates if available
    let basePrice = 150 // Default fallback
    if (rates && rates.length > 0) {
      basePrice = Math.min(...rates.map(rate => rate.price?.base || rate.retailRate?.total?.[0]?.amount || 150))
    }

    return {
      id: `liteapi_${hotel.id}`,
      source: PropertySource.LITEAPI,
      externalId: hotel.id,
      name: hotel.name,
      description: hotel.hotelDescription || hotel.description || `${hotel.name} - Premium accommodation in ${hotel.city}`,
      type: PropertyType.HOTEL, // LiteAPI is primarily hotels
      status: PropertyStatus.ACTIVE,
      
      location: {
        address: hotel.address,
        city: hotel.city,
        state: hotel.state || '',
        country: hotel.country || 'BR',
        zipCode: hotel.zip || hotel.postal_code || '',
        coordinates: {
          lat: hotel.location?.latitude || hotel.latitude || 0,
          lng: hotel.location?.longitude || hotel.longitude || 0
        }
      },
      
      images: (hotel.hotelImages || hotel.images || []).map((img, index) => ({
        id: `${hotel.id}_${index}`,
        url: img.url || img.urlHd,
        alt: img.caption || img.title || hotel.name,
        order: img.order || index,
        type: img.defaultImage ? 'main' : 'other',
        source: 'liteapi',
        width: img.width,
        height: img.height
      })),
      
      accommodates: maxAccommodates,
      bedrooms: totalBedrooms,
      bathrooms: Math.ceil(totalBedrooms * 0.8), // Estimate: ~0.8 bathrooms per bedroom
      beds: rooms.reduce((sum, room) => {
        const bedTypes = room.bedTypes || room.bed_configurations || []
        return sum + bedTypes.reduce((bedSum, bed) => bedSum + (bed.quantity || bed.count || 1), 0)
      }, 0),
      
      amenities: (() => {
        try {
          const facilities = hotel.hotelFacilities || hotel.amenities || []
          if (!Array.isArray(facilities)) return []
          return facilities.map(amenity => 
            typeof amenity === 'string' ? amenity : (amenity.name || 'Unknown amenity')
          )
        } catch (e) {
          console.warn(`⚠️  Error processing amenities for hotel ${hotel.id}:`, e)
          return []
        }
      })(),
      
      basePricePerNight: basePrice,
      currency: 'BRL',
      taxesIncluded: false,
      
      rating: hotel.starRating || hotel.rating || 0,
      reviewCount: hotel.review_count || 0,
      
      isInstantBookable: true, // Most LiteAPI properties are instant
      minimumStay: 1,
      
      checkInTime: hotel.checkinCheckoutTimes?.checkin || hotel.policies?.check_in?.from || '15:00',
      checkOutTime: hotel.checkinCheckoutTimes?.checkout || hotel.policies?.check_out?.to || '11:00',
      houseRules: [
        hotel.hotelImportantInformation && `Informações importantes: ${hotel.hotelImportantInformation}`,
        hotel.policies?.child_policy && `Política de crianças: ${hotel.policies.child_policy}`,
        hotel.policies?.pet_policy && `Política de animais: ${hotel.policies.pet_policy}`
      ].filter(Boolean),
      
      cancellationPolicy: {
        type: 'moderate' as any, // Default policy
        description: hotel.policies?.cancellation?.description || 'Cancellation policy varies by rate',
        rules: hotel.policies?.cancellation?.rules?.map(rule => ({
          beforeHours: rule.hours_before,
          refundPercentage: 100 - rule.penalty_percentage
        })) || []
      },
      
      liteApiData: {
        hotelId: hotel.id,
        chainId: hotel.chainId || hotel.chain_id,
        chainName: hotel.chain || hotel.chain_name,
        contentSource: 'liteapi',
        lastContentUpdate: new Date(),
        supplierMarkup: 15, // Default 15% markup
        baseCurrency: 'BRL', // Using BRL for Brazilian market
        rateType: 'net',
        bookingRules: {
          paymentDeadline: 24,
          cancellationDeadline: 24,
          childPolicy: hotel.policies?.child_policy,
          petPolicy: hotel.policies?.pet_policy
        },
        provider: 'liteapi',
        syncFrequency: 'hourly',
        lastPriceUpdate: new Date(),
        lastAvailabilityUpdate: new Date()
      },
      
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSyncedAt: new Date()
    }
    } catch (error) {
      console.error(`❌ Error transforming hotel ${hotel.id}:`, error)
      
      // Return a minimal property object with safe defaults
      return {
        id: `liteapi_${hotel.id}`,
        source: PropertySource.LITEAPI,
        externalId: hotel.id,
        name: hotel.name || 'Unknown Hotel',
        description: hotel.hotelDescription || hotel.description || 'Hotel details unavailable',
        type: PropertyType.HOTEL,
        status: PropertyStatus.ACTIVE,
        
        location: {
          address: hotel.address || '',
          city: hotel.city || '',
          state: '',
          country: 'BR',
          zipCode: '',
          coordinates: { lat: 0, lng: 0 }
        },
        
        images: [],
        accommodates: 2,
        bedrooms: 1,
        bathrooms: 1,
        beds: 1,
        amenities: [],
        
        basePricePerNight: 150,
        currency: 'BRL',
        taxesIncluded: false,
        rating: 0,
        reviewCount: 0,
        
        isInstantBookable: true,
        minimumStay: 1,
        checkInTime: '15:00',
        checkOutTime: '11:00',
        houseRules: [],
        
        cancellationPolicy: {
          type: 'moderate' as any,
          description: 'Standard cancellation policy',
          rules: []
        },
        
        liteApiData: {
          hotelId: hotel.id,
          chainId: undefined,
          chainName: undefined,
          contentSource: 'liteapi',
          lastContentUpdate: new Date(),
          supplierMarkup: 15,
          baseCurrency: 'BRL',
          rateType: 'net',
          bookingRules: {
            paymentDeadline: 24,
            cancellationDeadline: 24,
            childPolicy: undefined,
            petPolicy: undefined
          },
          provider: 'liteapi',
          syncFrequency: 'hourly',
          lastPriceUpdate: new Date(),
          lastAvailabilityUpdate: new Date()
        },
        
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSyncedAt: new Date()
      }
    }
  }

  // Transform LiteAPI Booking to Unified Booking
  private transformLiteApiBookingToUnified(liteBooking: LiteApiBookingResponse): UnifiedBooking {
    return {
      id: `liteapi_${liteBooking.booking_id}`,
      bookingNumber: liteBooking.confirmation_number,
      source: PropertySource.LITEAPI,
      externalBookingId: liteBooking.booking_id,
      
      propertyId: `liteapi_${liteBooking.hotel.id}`,
      property: this.transformLiteApiToUnified(liteBooking.hotel),
      
      // Guest details would need to be constructed from the booking data
      guestId: 'temp_guest_id', // Would be created/linked during booking
      guest: {} as any, // Would be populated from booking request
      
      checkIn: new Date(), // Would come from booking request
      checkOut: new Date(), // Would come from booking request
      nights: 1, // Would be calculated
      guests: 2, // Would come from booking request
      
      basePrice: liteBooking.price.base,
      taxes: liteBooking.price.taxes,
      fees: liteBooking.price.fees,
      discount: 0,
      totalPrice: liteBooking.price.total,
      currency: liteBooking.price.currency,
      
      paymentMethod: 'credit_card', // Would be determined by our payment flow
      paymentStatus: 'paid',
      
      commissionRate: 15, // Our markup
      commissionAmount: liteBooking.price.total * 0.15,
      netAmount: liteBooking.price.total * 0.85,
      
      status: liteBooking.status === 'confirmed' ? BookingStatus.CONFIRMED : BookingStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
      confirmedAt: liteBooking.status === 'confirmed' ? new Date() : undefined,
      
      liteApiBookingData: {
        bookingId: liteBooking.booking_id,
        hotelConfirmationNumber: liteBooking.confirmation_number,
        provider: liteBooking.supplier_info?.name || 'liteapi',
        rateKey: '', // Would come from booking flow
        supplierPrice: liteBooking.price.total,
        supplierCurrency: liteBooking.price.currency,
        markupApplied: 15,
        supplierStatus: liteBooking.status === 'failed' ? 'cancelled' : liteBooking.status,
        supplierNotifications: []
      },
      
      messages: []
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.makeRequest('health')
      return true
    } catch (error) {
      console.error('❌ LiteAPI Health Check Failed:', error)
      return false
    }
  }

  // Get API usage statistics
  async getUsageStats(): Promise<{
    requestsToday: number
    requestsThisMonth: number
    remainingQuota: number
  } | null> {
    try {
      const stats = await this.makeRequest<any>('account/usage')
      return {
        requestsToday: stats.requests_today || 0,
        requestsThisMonth: stats.requests_this_month || 0,
        remainingQuota: stats.remaining_quota || 0
      }
    } catch (error) {
      console.error('📊 Failed to get usage stats:', error)
      return null
    }
  }
}

// Singleton instance
export const liteApiService = new LiteApiService()

// Utility functions
export const LiteApiUtils = {
  // Calculate nights between dates
  calculateNights(checkIn: Date, checkOut: Date): number {
    const diffTime = Math.abs(checkOut.getTime() - checkIn.getTime())
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  },

  // Apply dynamic markup based on demand, seasonality, etc.
  calculateDynamicMarkup(baseMarkup: number, factors: {
    demand?: 'low' | 'medium' | 'high'
    season?: 'low' | 'peak'
    competition?: number // 0-1 scale
    propertyRating?: number
  }): number {
    let finalMarkup = baseMarkup

    // Demand adjustment
    if (factors.demand === 'high') finalMarkup *= 1.2
    if (factors.demand === 'low') finalMarkup *= 0.9

    // Seasonal adjustment
    if (factors.season === 'peak') finalMarkup *= 1.15

    // Competition adjustment (higher competition = lower markup)
    if (factors.competition !== undefined) {
      finalMarkup *= (1 - factors.competition * 0.1)
    }

    // Quality adjustment
    if (factors.propertyRating && factors.propertyRating > 4.5) {
      finalMarkup *= 1.05
    }

    return Math.round(finalMarkup * 100) / 100
  },

  // Format price with currency
  formatPrice(amount: number, currency: string = 'BRL'): string {
    const safeCurrency = currency || 'BRL'
    try {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: safeCurrency
      }).format(amount)
    } catch (error) {
      console.warn(`Currency formatting error for ${safeCurrency}:`, error)
      return `R$ ${amount.toFixed(2)}`
    }
  },

  // Check if booking is refundable
  isRefundable(cancellationPolicy: any, checkIn: Date): boolean {
    if (!cancellationPolicy?.rules?.length) return false
    
    const now = new Date()
    const hoursUntilCheckIn = (checkIn.getTime() - now.getTime()) / (1000 * 60 * 60)
    
    return cancellationPolicy.rules.some((rule: any) => 
      hoursUntilCheckIn >= rule.beforeHours && rule.refundPercentage > 50
    )
  }
}
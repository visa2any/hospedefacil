// Real Database Property Service - Production Ready
// Connects to PostgreSQL using Prisma for real property management

import { PrismaClient } from '@prisma/client'
import { 
  UnifiedProperty,
  PropertySource,
  PropertyType, 
  PropertyStatus,
  SearchFilters,
  PropertyAvailability,
  UnifiedBooking,
  LocalPropertyData,
  BookingStatus,
  PaymentStatus
} from '../database/schemas'

// Database connection with connection pooling
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  },
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

// Connection health check
let isConnected = false
prisma.$connect()
  .then(() => {
    isConnected = true
    console.log('🗄️  PostgreSQL connection established successfully')
  })
  .catch(error => {
    console.error('❌ PostgreSQL connection failed:', error)
  })

export class DatabasePropertyService {
  private prisma: PrismaClient

  constructor() {
    this.prisma = prisma
  }

  // Check database connection
  async isHealthy(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`
      return true
    } catch (error) {
      console.error('❌ Database health check failed:', error)
      return false
    }
  }

  // Search properties with real database queries
  async searchProperties(filters: SearchFilters): Promise<UnifiedProperty[]> {
    try {
      console.log('🔍 DatabasePropertyService: Searching properties with filters:', filters)
      
      const where: any = {
        status: PropertyStatus.ACTIVE,
        // Guest capacity filter
        maxGuests: {
          gte: (filters.adults || 0) + (filters.children || 0)
        }
      }

      // Location filter - search by city, state or property name
      if (filters.destination) {
        const searchTerm = filters.destination.toLowerCase()
        where.OR = [
          { city: { contains: searchTerm, mode: 'insensitive' } },
          { state: { contains: searchTerm, mode: 'insensitive' } },
          { title: { contains: searchTerm, mode: 'insensitive' } },
          { neighborhood: { contains: searchTerm, mode: 'insensitive' } }
        ]
      }

      // Coordinates filter (geo search)
      if (filters.coordinates) {
        const { lat, lng, radius = 50 } = filters.coordinates
        // Using Haversine formula for distance calculation
        where.AND = [
          {
            latitude: {
              gte: lat - radius / 111, // Rough degree conversion
              lte: lat + radius / 111
            }
          },
          {
            longitude: {
              gte: lng - radius / (111 * Math.cos(lat * Math.PI / 180)),
              lte: lng + radius / (111 * Math.cos(lat * Math.PI / 180))
            }
          }
        ]
      }

      // Property type filter
      if (filters.propertyTypes?.length) {
        where.type = { in: filters.propertyTypes }
      }

      // Bedrooms filter
      if (filters.minBedrooms) {
        where.bedrooms = { gte: filters.minBedrooms }
      }

      // Bathrooms filter
      if (filters.minBathrooms) {
        where.bathrooms = { gte: filters.minBathrooms }
      }

      // Price range filter
      if (filters.minPrice || filters.maxPrice) {
        where.basePrice = {}
        if (filters.minPrice) where.basePrice.gte = filters.minPrice
        if (filters.maxPrice) where.basePrice.lte = filters.maxPrice
      }

      // Instant bookable filter
      if (filters.instantBookable) {
        where.isInstantBookable = true
      }

      // Date availability filter
      if (filters.checkIn && filters.checkOut) {
        // Check if property has available dates in the range
        where.NOT = {
          bookings: {
            some: {
              AND: [
                { status: { in: [BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS] } },
                {
                  OR: [
                    {
                      checkIn: { lte: filters.checkIn },
                      checkOut: { gte: filters.checkIn }
                    },
                    {
                      checkIn: { lte: filters.checkOut },
                      checkOut: { gte: filters.checkOut }
                    },
                    {
                      checkIn: { gte: filters.checkIn },
                      checkOut: { lte: filters.checkOut }
                    }
                  ]
                }
              ]
            }
          }
        }
      }

      // Build sorting
      const orderBy: any = {}
      switch (filters.sortBy) {
        case 'price':
          orderBy.basePrice = filters.sortOrder || 'asc'
          break
        case 'rating':
          orderBy.averageRating = filters.sortOrder || 'desc'
          break
        case 'popularity':
          orderBy.totalBookings = filters.sortOrder || 'desc'
          break
        case 'created':
        default:
          orderBy.createdAt = filters.sortOrder || 'desc'
      }

      // Execute query with pagination
      const properties = await this.prisma.property.findMany({
        where,
        include: {
          images: true,
          amenities: {
            include: {
              amenity: true
            }
          },
          host: {
            include: {
              hostProfile: true
            }
          },
          reviews: {
            take: 5, // Latest 5 reviews
            orderBy: { createdAt: 'desc' }
          },
          _count: {
            select: {
              bookings: {
                where: { status: BookingStatus.COMPLETED }
              },
              reviews: true
            }
          }
        },
        orderBy,
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit
      })

      console.log(`🎯 Found ${properties.length} properties in database`)

      // Transform to UnifiedProperty format
      return properties.map(property => this.transformDbPropertyToUnified(property))

    } catch (error) {
      console.error('❌ Database search failed:', error)
      throw new Error(`Database search failed: ${error.message}`)
    }
  }

  // Get property by ID with full details
  async getProperty(propertyId: string): Promise<UnifiedProperty | null> {
    try {
      // Extract ID from unified format if needed
      const dbId = propertyId.startsWith('local_') ? propertyId.replace('local_', '') : propertyId

      const property = await this.prisma.property.findUnique({
        where: { id: dbId },
        include: {
          images: true,
          amenities: {
            include: {
              amenity: true
            }
          },
          host: {
            include: {
              hostProfile: true
            }
          },
          reviews: {
            include: {
              author: true,
              responses: true
            },
            orderBy: { createdAt: 'desc' }
          },
          bookings: {
            where: {
              status: { in: [BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS] }
            },
            select: {
              checkIn: true,
              checkOut: true,
              status: true
            }
          },
          pricingRules: true,
          availability: {
            where: {
              date: {
                gte: new Date(),
                lte: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // Next year
              }
            }
          }
        }
      })

      if (!property) {
        console.log(`🔍 Property not found: ${propertyId}`)
        return null
      }

      return this.transformDbPropertyToUnified(property)

    } catch (error) {
      console.error(`❌ Failed to get property ${propertyId}:`, error)
      return null
    }
  }

  // Get availability for date range
  async getAvailability(
    propertyId: string, 
    checkIn: Date, 
    checkOut: Date
  ): Promise<PropertyAvailability[]> {
    try {
      const dbId = propertyId.startsWith('local_') ? propertyId.replace('local_', '') : propertyId

      // Get property to check base price
      const property = await this.prisma.property.findUnique({
        where: { id: dbId },
        select: {
          id: true,
          basePrice: true,
          cleaningFee: true,
          serviceFee: true
        }
      })

      if (!property) return []

      // Check for existing bookings in date range
      const conflictingBookings = await this.prisma.booking.findMany({
        where: {
          propertyId: dbId,
          status: { in: [BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS] },
          OR: [
            {
              checkIn: { lte: checkIn },
              checkOut: { gte: checkIn }
            },
            {
              checkIn: { lte: checkOut },
              checkOut: { gte: checkOut }
            },
            {
              checkIn: { gte: checkIn },
              checkOut: { lte: checkOut }
            }
          ]
        }
      })

      const isAvailable = conflictingBookings.length === 0

      // Get custom pricing for date range
      const customPricing = await this.prisma.propertyAvailability.findMany({
        where: {
          propertyId: dbId,
          date: {
            gte: checkIn,
            lte: checkOut
          }
        }
      })

      // Calculate nights
      const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24))
      
      // Calculate dynamic pricing
      let totalBasePrice = 0
      const currentDate = new Date(checkIn)
      
      for (let i = 0; i < nights; i++) {
        const dayPrice = customPricing.find(cp => 
          cp.date.toDateString() === currentDate.toDateString()
        )?.price || property.basePrice
        
        totalBasePrice += dayPrice
        currentDate.setDate(currentDate.getDate() + 1)
      }

      const taxes = Math.round(totalBasePrice * 0.05) // 5% tax
      const fees = property.cleaningFee + property.serviceFee
      const totalPrice = totalBasePrice + taxes + fees

      const availability: PropertyAvailability = {
        propertyId,
        source: PropertySource.LOCAL,
        checkIn,
        checkOut,
        isAvailable,
        basePrice: totalBasePrice,
        taxes,
        fees,
        discounts: 0,
        totalPrice,
        currency: 'BRL',
        rateId: `db_rate_${dbId}_${checkIn.toISOString().split('T')[0]}_${checkOut.toISOString().split('T')[0]}`,
        rateType: 'standard',
        rateDescription: `${nights} ${nights === 1 ? 'diária' : 'diárias'}`,
        minimumStay: 1,
        maximumStay: 365,
        freeCancellationUntil: new Date(checkIn.getTime() - 24 * 60 * 60 * 1000), // 24h before
        cachedAt: new Date(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
      }

      return [availability]

    } catch (error) {
      console.error(`❌ Failed to get availability for ${propertyId}:`, error)
      return []
    }
  }

  // Create booking in database
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
    totalPrice: number
  }): Promise<UnifiedBooking | null> {
    try {
      const dbId = bookingData.propertyId.startsWith('local_') 
        ? bookingData.propertyId.replace('local_', '') 
        : bookingData.propertyId

      // Start transaction
      const result = await this.prisma.$transaction(async (tx) => {
        // Get or create guest user
        let guest = await tx.user.findUnique({
          where: { email: bookingData.guestInfo.email }
        })

        if (!guest) {
          guest = await tx.user.create({
            data: {
              email: bookingData.guestInfo.email,
              name: bookingData.guestInfo.name,
              phone: bookingData.guestInfo.phone,
              cpf: bookingData.guestInfo.cpf,
              role: 'GUEST'
            }
          })
        }

        // Calculate nights and pricing
        const nights = Math.ceil((bookingData.checkOut.getTime() - bookingData.checkIn.getTime()) / (1000 * 60 * 60 * 24))
        const basePrice = bookingData.totalPrice * 0.9 // Assume 10% fees/taxes
        const taxes = bookingData.totalPrice * 0.05
        const serviceFee = bookingData.totalPrice * 0.05

        // Create booking
        const booking = await tx.booking.create({
          data: {
            propertyId: dbId,
            guestId: guest.id,
            checkIn: bookingData.checkIn,
            checkOut: bookingData.checkOut,
            guests: bookingData.guests.adults + bookingData.guests.children,
            nights,
            basePrice,
            cleaningFee: 0,
            serviceFee,
            taxes,
            totalPrice: bookingData.totalPrice,
            status: BookingStatus.PENDING,
            guestName: bookingData.guestInfo.name,
            guestEmail: bookingData.guestInfo.email,
            guestPhone: bookingData.guestInfo.phone,
            message: bookingData.specialRequests
          },
          include: {
            property: {
              include: {
                host: true
              }
            },
            guest: true
          }
        })

        // Create payment record
        await tx.payment.create({
          data: {
            bookingId: booking.id,
            amount: bookingData.totalPrice,
            method: bookingData.paymentMethod === 'pix' ? 'PIX' : 'CREDIT_CARD',
            status: PaymentStatus.PENDING
          }
        })

        return booking
      })

      console.log(`✅ Booking created: ${result.id}`)
      return this.transformDbBookingToUnified(result)

    } catch (error) {
      console.error('❌ Failed to create booking:', error)
      throw new Error(`Booking creation failed: ${error.message}`)
    }
  }

  // Create new property
  async createProperty(propertyData: {
    hostId: string
    title: string
    description: string
    type: PropertyType
    address: string
    city: string
    state: string
    zipCode: string
    coordinates: { lat: number; lng: number }
    bedrooms: number
    bathrooms: number
    beds: number
    maxGuests: number
    basePrice: number
    amenities: string[]
    images: Array<{ url: string; alt: string }>
  }): Promise<UnifiedProperty | null> {
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // Create property
        const property = await tx.property.create({
          data: {
            hostId: propertyData.hostId,
            title: propertyData.title,
            description: propertyData.description,
            type: propertyData.type,
            status: PropertyStatus.UNDER_REVIEW,
            street: propertyData.address,
            city: propertyData.city,
            state: propertyData.state,
            zipCode: propertyData.zipCode,
            latitude: propertyData.coordinates.lat,
            longitude: propertyData.coordinates.lng,
            bedrooms: propertyData.bedrooms,
            bathrooms: propertyData.bathrooms,
            beds: propertyData.beds,
            maxGuests: propertyData.maxGuests,
            basePrice: propertyData.basePrice
          }
        })

        // Create images
        if (propertyData.images.length > 0) {
          await tx.propertyImage.createMany({
            data: propertyData.images.map((img, index) => ({
              propertyId: property.id,
              url: img.url,
              alt: img.alt,
              order: index
            }))
          })
        }

        // Create/link amenities
        for (const amenityName of propertyData.amenities) {
          // Get or create amenity
          let amenity = await tx.amenity.findFirst({
            where: { name: amenityName }
          })

          if (!amenity) {
            amenity = await tx.amenity.create({
              data: {
                name: amenityName,
                nameEn: amenityName,
                icon: 'default',
                category: 'general'
              }
            })
          }

          // Link to property
          await tx.propertyAmenity.create({
            data: {
              propertyId: property.id,
              amenityId: amenity.id
            }
          })
        }

        return property.id
      })

      console.log(`✅ Property created: ${result}`)
      return await this.getProperty(result)

    } catch (error) {
      console.error('❌ Failed to create property:', error)
      throw new Error(`Property creation failed: ${error.message}`)
    }
  }

  // Update property
  async updateProperty(
    propertyId: string, 
    updates: Partial<any>
  ): Promise<UnifiedProperty | null> {
    try {
      const dbId = propertyId.startsWith('local_') ? propertyId.replace('local_', '') : propertyId

      await this.prisma.property.update({
        where: { id: dbId },
        data: {
          ...updates,
          updatedAt: new Date()
        }
      })

      console.log(`✅ Property updated: ${propertyId}`)
      return await this.getProperty(propertyId)

    } catch (error) {
      console.error(`❌ Failed to update property ${propertyId}:`, error)
      throw new Error(`Property update failed: ${error.message}`)
    }
  }

  // Delete property
  async deleteProperty(propertyId: string): Promise<boolean> {
    try {
      const dbId = propertyId.startsWith('local_') ? propertyId.replace('local_', '') : propertyId

      await this.prisma.property.update({
        where: { id: dbId },
        data: { 
          status: PropertyStatus.INACTIVE,
          updatedAt: new Date()
        }
      })

      console.log(`✅ Property deleted: ${propertyId}`)
      return true

    } catch (error) {
      console.error(`❌ Failed to delete property ${propertyId}:`, error)
      return false
    }
  }

  // Get properties by host
  async getPropertiesByHost(hostId: string): Promise<UnifiedProperty[]> {
    try {
      const properties = await this.prisma.property.findMany({
        where: { 
          hostId,
          status: { not: PropertyStatus.INACTIVE }
        },
        include: {
          images: true,
          amenities: { include: { amenity: true } },
          _count: { select: { bookings: true, reviews: true } }
        },
        orderBy: { createdAt: 'desc' }
      })

      return properties.map(property => this.transformDbPropertyToUnified(property))

    } catch (error) {
      console.error(`❌ Failed to get properties for host ${hostId}:`, error)
      return []
    }
  }

  // Get bookings by property
  async getBookingsByProperty(propertyId: string): Promise<UnifiedBooking[]> {
    try {
      const dbId = propertyId.startsWith('local_') ? propertyId.replace('local_', '') : propertyId

      const bookings = await this.prisma.booking.findMany({
        where: { propertyId: dbId },
        include: {
          guest: true,
          property: { include: { host: true } },
          payments: true
        },
        orderBy: { createdAt: 'desc' }
      })

      return bookings.map(booking => this.transformDbBookingToUnified(booking))

    } catch (error) {
      console.error(`❌ Failed to get bookings for property ${propertyId}:`, error)
      return []
    }
  }

  // Analytics and stats
  async getStats(): Promise<{
    totalProperties: number
    totalBookings: number
    totalRevenue: number
    averageRating: number
    occupancyRate: number
    topCities: Array<{ city: string; count: number }>
  }> {
    try {
      const [
        totalProperties,
        totalBookings,
        revenueData,
        ratingData,
        cityData
      ] = await Promise.all([
        this.prisma.property.count({ where: { status: PropertyStatus.ACTIVE } }),
        this.prisma.booking.count({ where: { status: BookingStatus.COMPLETED } }),
        this.prisma.booking.aggregate({
          where: { status: BookingStatus.COMPLETED },
          _sum: { totalPrice: true }
        }),
        this.prisma.property.aggregate({
          where: { status: PropertyStatus.ACTIVE },
          _avg: { averageRating: true }
        }),
        this.prisma.property.groupBy({
          by: ['city'],
          _count: { city: true },
          orderBy: { _count: { city: 'desc' } },
          take: 10
        })
      ])

      const totalRevenue = revenueData._sum.totalPrice || 0
      const averageRating = ratingData._avg.averageRating || 0
      const occupancyRate = totalProperties > 0 ? (totalBookings / totalProperties) * 100 : 0

      return {
        totalProperties,
        totalBookings,
        totalRevenue,
        averageRating,
        occupancyRate,
        topCities: cityData.map(item => ({
          city: item.city,
          count: item._count.city
        }))
      }

    } catch (error) {
      console.error('❌ Failed to get stats:', error)
      return {
        totalProperties: 0,
        totalBookings: 0,
        totalRevenue: 0,
        averageRating: 0,
        occupancyRate: 0,
        topCities: []
      }
    }
  }

  // Transform database property to unified format
  private transformDbPropertyToUnified(dbProperty: any): UnifiedProperty {
    return {
      id: `local_${dbProperty.id}`,
      source: PropertySource.LOCAL,
      externalId: dbProperty.id,
      
      name: dbProperty.title,
      description: dbProperty.description,
      type: dbProperty.type,
      status: dbProperty.status,
      
      location: {
        address: `${dbProperty.street}${dbProperty.number ? `, ${dbProperty.number}` : ''}`,
        city: dbProperty.city,
        state: dbProperty.state,
        country: 'Brasil',
        zipCode: dbProperty.zipCode,
        coordinates: {
          lat: dbProperty.latitude,
          lng: dbProperty.longitude
        },
        neighborhood: dbProperty.neighborhood,
        timezone: 'America/Sao_Paulo'
      },
      
      images: (dbProperty.images || []).map((img: any) => ({
        id: img.id,
        url: img.url,
        alt: img.alt || dbProperty.title,
        order: img.order,
        type: img.order === 0 ? 'main' : 'other'
      })),
      
      accommodates: dbProperty.maxGuests,
      bedrooms: dbProperty.bedrooms,
      bathrooms: dbProperty.bathrooms,
      beds: dbProperty.beds,
      
      amenities: (dbProperty.amenities || []).map((pa: any) => pa.amenity.name),
      
      basePricePerNight: dbProperty.basePrice,
      currency: 'BRL',
      taxesIncluded: false,
      
      rating: dbProperty.averageRating || 0,
      reviewCount: dbProperty._count?.reviews || 0,
      
      isInstantBookable: true,
      minimumStay: dbProperty.minStay || 1,
      maximumStay: dbProperty.maxStay || 365,
      
      checkInTime: dbProperty.checkInTime || '15:00',
      checkOutTime: dbProperty.checkOutTime || '11:00',
      houseRules: [],
      
      cancellationPolicy: {
        type: 'moderate',
        description: 'Cancelamento moderado',
        rules: []
      },
      
      localData: {
        hostId: dbProperty.hostId,
        hostName: dbProperty.host?.name || 'Anfitrião',
        hostPhone: dbProperty.host?.phone || '',
        hostEmail: dbProperty.host?.email || '',
        hostAvatar: dbProperty.host?.avatar,
        isSuperhost: dbProperty.host?.hostProfile?.isSuperHost || false,
        isVerified: dbProperty.host?.hostProfile?.identityVerified || false,
        verifiedDocuments: ['CPF'],
        commissionRate: 12,
        payoutMethod: 'pix',
        payoutDetails: {},
        responseRate: dbProperty.host?.hostProfile?.responseRate || 95,
        responseTime: dbProperty.host?.hostProfile?.responseTime || 60,
        acceptanceRate: 90,
        customSettings: {}
      },
      
      createdAt: dbProperty.createdAt,
      updatedAt: dbProperty.updatedAt,
      lastSyncedAt: new Date()
    }
  }

  // Transform database booking to unified format
  private transformDbBookingToUnified(dbBooking: any): UnifiedBooking {
    return {
      id: `local_${dbBooking.id}`,
      bookingNumber: dbBooking.id,
      source: PropertySource.LOCAL,
      externalBookingId: dbBooking.id,
      
      propertyId: `local_${dbBooking.propertyId}`,
      property: this.transformDbPropertyToUnified(dbBooking.property),
      
      guestId: dbBooking.guestId,
      guest: {
        id: dbBooking.guest.id,
        name: dbBooking.guest.name,
        email: dbBooking.guest.email,
        phone: dbBooking.guest.phone,
        avatar: dbBooking.guest.avatar
      },
      
      checkIn: dbBooking.checkIn,
      checkOut: dbBooking.checkOut,
      nights: dbBooking.nights,
      guests: dbBooking.guests,
      
      basePrice: dbBooking.basePrice,
      taxes: dbBooking.taxes,
      fees: dbBooking.serviceFee + dbBooking.cleaningFee,
      discount: 0,
      totalPrice: dbBooking.totalPrice,
      currency: 'BRL',
      
      paymentMethod: 'pix',
      paymentStatus: dbBooking.payments?.[0]?.status === 'COMPLETED' ? 'paid' : 'pending',
      
      commissionRate: 12,
      commissionAmount: dbBooking.totalPrice * 0.12,
      netAmount: dbBooking.totalPrice * 0.88,
      
      status: dbBooking.status,
      createdAt: dbBooking.createdAt,
      updatedAt: dbBooking.updatedAt,
      confirmedAt: dbBooking.status === BookingStatus.CONFIRMED ? dbBooking.updatedAt : undefined,
      
      messages: []
    }
  }

  // Cleanup and close connections
  async disconnect(): Promise<void> {
    await this.prisma.$disconnect()
    console.log('🗄️  PostgreSQL connection closed')
  }
}

// Singleton instance
export const databasePropertyService = new DatabasePropertyService()

// Graceful shutdown
process.on('beforeExit', async () => {
  await databasePropertyService.disconnect()
})
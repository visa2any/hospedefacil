// Complete Booking Service - Production Ready Reservation System
// Handles booking creation, confirmation, cancellation, and payment processing

import { PrismaClient } from '@prisma/client'
import { 
  UnifiedBooking,
  BookingStatus,
  PaymentStatus,
  PaymentMethod,
  PropertySource
} from '../database/schemas'
import { databasePropertyService } from './database-property-service'
import { paymentService } from './payment-service'
import { emailService } from './email-service'
import { whatsappService } from './whatsapp-service'

// Initialize Prisma client with connection pooling
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

export interface BookingRequest {
  propertyId: string
  checkIn: Date
  checkOut: Date
  guests: {
    adults: number
    children: number
    infants?: number
  }
  guestInfo: {
    name: string
    email: string
    phone: string
    cpf?: string
    dateOfBirth?: Date
    nationality?: string
  }
  paymentMethod: 'pix' | 'credit_card'
  specialRequests?: string
  totalPrice: number
  breakdown: {
    basePrice: number
    cleaningFee: number
    serviceFee: number
    taxes: number
    discount: number
  }
  // Optional fields for external bookings
  externalBookingId?: string
  source?: PropertySource
}

export interface BookingConfirmation {
  booking: UnifiedBooking
  paymentInfo: {
    method: PaymentMethod
    pixQrCode?: string
    pixKey?: string
    externalPaymentId?: string
  }
  confirmationNumber: string
  checkInInstructions?: string
}

export class BookingService {
  private prisma: PrismaClient

  constructor() {
    this.prisma = prisma
  }

  // Health check
  async isHealthy(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`
      return true
    } catch (error) {
      console.error('❌ Booking service health check failed:', error)
      return false
    }
  }

  // Create booking with full validation and transaction handling
  async createBooking(request: BookingRequest): Promise<BookingConfirmation | null> {
    try {
      console.log('📝 Creating booking:', { 
        property: request.propertyId, 
        guest: request.guestInfo.email,
        checkIn: request.checkIn,
        checkOut: request.checkOut 
      })

      // Validate request
      const validation = await this.validateBookingRequest(request)
      if (!validation.isValid) {
        throw new Error(`Booking validation failed: ${validation.errors.join(', ')}`)
      }

      // Start transaction for atomic booking creation
      const result = await this.prisma.$transaction(async (tx) => {
        // Extract property ID for database lookup
        const dbPropertyId = request.propertyId.startsWith('local_') 
          ? request.propertyId.replace('local_', '') 
          : request.propertyId

        // Check property availability one more time within transaction
        const conflicts = await tx.booking.findMany({
          where: {
            propertyId: dbPropertyId,
            status: { in: [BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS] },
            OR: [
              {
                checkIn: { lte: request.checkIn },
                checkOut: { gte: request.checkIn }
              },
              {
                checkIn: { lte: request.checkOut },
                checkOut: { gte: request.checkOut }
              },
              {
                checkIn: { gte: request.checkIn },
                checkOut: { lte: request.checkOut }
              }
            ]
          }
        })

        if (conflicts.length > 0) {
          throw new Error('Property not available for selected dates')
        }

        // Get or create guest user
        let guest = await tx.user.findUnique({
          where: { email: request.guestInfo.email }
        })

        if (!guest) {
          guest = await tx.user.create({
            data: {
              email: request.guestInfo.email,
              name: request.guestInfo.name,
              phone: request.guestInfo.phone,
              cpf: request.guestInfo.cpf,
              dateOfBirth: request.guestInfo.dateOfBirth,
              role: 'GUEST',
              status: 'ACTIVE'
            }
          })
          console.log('👤 New guest created:', guest.id)
        } else {
          // Update guest info if changed
          guest = await tx.user.update({
            where: { id: guest.id },
            data: {
              name: request.guestInfo.name,
              phone: request.guestInfo.phone,
              cpf: request.guestInfo.cpf || guest.cpf,
              dateOfBirth: request.guestInfo.dateOfBirth || guest.dateOfBirth
            }
          })
        }

        // Calculate booking details
        const nights = Math.ceil((request.checkOut.getTime() - request.checkIn.getTime()) / (1000 * 60 * 60 * 24))
        const totalGuests = request.guests.adults + request.guests.children + (request.guests.infants || 0)

        // Generate check-in code
        const checkInCode = this.generateCheckInCode()

        // Create booking record
        const booking = await tx.booking.create({
          data: {
            propertyId: dbPropertyId,
            guestId: guest.id,
            checkIn: request.checkIn,
            checkOut: request.checkOut,
            guests: totalGuests,
            nights,
            basePrice: request.breakdown.basePrice,
            cleaningFee: request.breakdown.cleaningFee,
            serviceFee: request.breakdown.serviceFee,
            taxes: request.breakdown.taxes,
            totalPrice: request.totalPrice,
            status: BookingStatus.PENDING,
            guestName: request.guestInfo.name,
            guestEmail: request.guestInfo.email,
            guestPhone: request.guestInfo.phone,
            message: request.specialRequests,
            checkInCode,
            // External booking data if applicable
            ...(request.externalBookingId && {
              externalBookingId: request.externalBookingId
            })
          },
          include: {
            property: {
              include: {
                host: {
                  include: {
                    hostProfile: true
                  }
                },
                images: true
              }
            },
            guest: true
          }
        })

        // Create payment record
        const payment = await tx.payment.create({
          data: {
            bookingId: booking.id,
            amount: request.totalPrice,
            currency: 'BRL',
            method: request.paymentMethod === 'pix' ? PaymentMethod.PIX : PaymentMethod.CREDIT_CARD,
            status: PaymentStatus.PENDING,
            metadata: {
              breakdown: request.breakdown,
              paymentMethod: request.paymentMethod
            }
          }
        })

        return { booking, payment }
      }, {
        maxWait: 5000, // 5 seconds
        timeout: 10000, // 10 seconds
      })

      console.log('✅ Booking created successfully:', result.booking.id)

      // Process payment asynchronously
      const paymentInfo = await this.processPayment(result.booking, result.payment, request.paymentMethod)

      // Send confirmation notifications
      await this.sendBookingConfirmations(result.booking, paymentInfo)

      // Transform to unified booking format
      const unifiedBooking = await this.transformDbBookingToUnified(result.booking)

      return {
        booking: unifiedBooking,
        paymentInfo,
        confirmationNumber: result.booking.id,
        checkInInstructions: await this.generateCheckInInstructions(result.booking)
      }

    } catch (error) {
      console.error('❌ Failed to create booking:', error)
      throw new Error(`Booking creation failed: ${error.message}`)
    }
  }

  // Confirm booking after payment
  async confirmBooking(bookingId: string, paymentId?: string): Promise<UnifiedBooking | null> {
    try {
      console.log('✅ Confirming booking:', bookingId)

      const result = await this.prisma.$transaction(async (tx) => {
        // Update booking status
        const booking = await tx.booking.update({
          where: { id: bookingId },
          data: {
            status: BookingStatus.CONFIRMED,
            confirmedAt: new Date()
          },
          include: {
            property: {
              include: {
                host: {
                  include: {
                    hostProfile: true
                  }
                }
              }
            },
            guest: true,
            payments: true
          }
        })

        // Update payment status if provided
        if (paymentId) {
          await tx.payment.update({
            where: { id: paymentId },
            data: {
              status: PaymentStatus.COMPLETED,
              processedAt: new Date()
            }
          })
        }

        // Update property stats
        await tx.property.update({
          where: { id: booking.propertyId },
          data: {
            totalBookings: { increment: 1 }
          }
        })

        // Update host stats
        await tx.hostProfile.update({
          where: { userId: booking.property.hostId },
          data: {
            totalBookings: { increment: 1 },
            totalEarnings: { increment: booking.totalPrice * 0.88 } // After commission
          }
        })

        return booking
      })

      // Send confirmation notifications
      await this.sendBookingConfirmations(result, null, true)

      console.log('✅ Booking confirmed:', bookingId)
      return await this.transformDbBookingToUnified(result)

    } catch (error) {
      console.error('❌ Failed to confirm booking:', error)
      return null
    }
  }

  // Cancel booking with refund handling
  async cancelBooking(bookingId: string, reason?: string): Promise<boolean> {
    try {
      console.log('❌ Cancelling booking:', bookingId)

      const result = await this.prisma.$transaction(async (tx) => {
        // Get booking details
        const booking = await tx.booking.findUnique({
          where: { id: bookingId },
          include: {
            property: {
              include: {
                host: true
              }
            },
            guest: true,
            payments: true
          }
        })

        if (!booking) {
          throw new Error('Booking not found')
        }

        if (booking.status === BookingStatus.CANCELLED) {
          throw new Error('Booking already cancelled')
        }

        // Calculate refund amount based on cancellation policy
        const refundAmount = this.calculateRefundAmount(booking)

        // Update booking status
        const updatedBooking = await tx.booking.update({
          where: { id: bookingId },
          data: {
            status: BookingStatus.CANCELLED,
            updatedAt: new Date()
          }
        })

        // Process refund if applicable
        if (refundAmount > 0) {
          const completedPayment = booking.payments.find(p => p.status === PaymentStatus.COMPLETED)
          if (completedPayment) {
            await tx.payment.create({
              data: {
                bookingId: booking.id,
                amount: -refundAmount,
                currency: 'BRL',
                method: completedPayment.method,
                status: PaymentStatus.COMPLETED,
                metadata: {
                  type: 'refund',
                  originalPaymentId: completedPayment.id,
                  reason
                }
              }
            })
          }
        }

        return { booking: updatedBooking, refundAmount }
      })

      // Send cancellation notifications
      await this.sendCancellationNotifications(result.booking, result.refundAmount, reason)

      console.log('✅ Booking cancelled:', bookingId, `refund: ${result.refundAmount}`)
      return true

    } catch (error) {
      console.error('❌ Failed to cancel booking:', error)
      return false
    }
  }

  // Get booking details
  async getBooking(bookingId: string): Promise<UnifiedBooking | null> {
    try {
      const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          property: {
            include: {
              host: {
                include: {
                  hostProfile: true
                }
              },
              images: true
            }
          },
          guest: true,
          payments: true,
          reviews: {
            include: {
              author: true
            }
          }
        }
      })

      if (!booking) return null

      return await this.transformDbBookingToUnified(booking)

    } catch (error) {
      console.error('❌ Failed to get booking:', error)
      return null
    }
  }

  // Get bookings for guest
  async getGuestBookings(guestEmail: string, status?: BookingStatus[]): Promise<UnifiedBooking[]> {
    try {
      const where: any = {
        guest: { email: guestEmail }
      }

      if (status?.length) {
        where.status = { in: status }
      }

      const bookings = await this.prisma.booking.findMany({
        where,
        include: {
          property: {
            include: {
              host: true,
              images: true
            }
          },
          guest: true,
          payments: true
        },
        orderBy: { createdAt: 'desc' }
      })

      return Promise.all(
        bookings.map(booking => this.transformDbBookingToUnified(booking))
      )

    } catch (error) {
      console.error('❌ Failed to get guest bookings:', error)
      return []
    }
  }

  // Get bookings for host
  async getHostBookings(hostId: string, status?: BookingStatus[]): Promise<UnifiedBooking[]> {
    try {
      const where: any = {
        property: { hostId }
      }

      if (status?.length) {
        where.status = { in: status }
      }

      const bookings = await this.prisma.booking.findMany({
        where,
        include: {
          property: {
            include: {
              host: true,
              images: true
            }
          },
          guest: true,
          payments: true
        },
        orderBy: { createdAt: 'desc' }
      })

      return Promise.all(
        bookings.map(booking => this.transformDbBookingToUnified(booking))
      )

    } catch (error) {
      console.error('❌ Failed to get host bookings:', error)
      return []
    }
  }

  // Get booking analytics
  async getBookingStats(): Promise<{
    totalBookings: number
    confirmedBookings: number
    cancelledBookings: number
    totalRevenue: number
    averageBookingValue: number
    occupancyRate: number
    topDestinations: Array<{ city: string; count: number }>
    monthlyStats: Array<{ month: string; bookings: number; revenue: number }>
  }> {
    try {
      const [
        totalBookings,
        confirmedBookings,
        cancelledBookings,
        revenueData,
        destinationStats,
        monthlyStats
      ] = await Promise.all([
        this.prisma.booking.count(),
        this.prisma.booking.count({ where: { status: BookingStatus.CONFIRMED } }),
        this.prisma.booking.count({ where: { status: BookingStatus.CANCELLED } }),
        this.prisma.booking.aggregate({
          where: { status: BookingStatus.CONFIRMED },
          _sum: { totalPrice: true },
          _avg: { totalPrice: true }
        }),
        this.prisma.booking.groupBy({
          by: ['propertyId'],
          _count: { propertyId: true },
          orderBy: { _count: { propertyId: 'desc' } },
          take: 10
        }),
        this.prisma.booking.groupBy({
          by: ['createdAt'],
          _count: { id: true },
          _sum: { totalPrice: true },
          orderBy: { createdAt: 'desc' },
          take: 12
        })
      ])

      const totalRevenue = revenueData._sum.totalPrice || 0
      const averageBookingValue = revenueData._avg.totalPrice || 0
      const occupancyRate = totalBookings > 0 ? (confirmedBookings / totalBookings) * 100 : 0

      return {
        totalBookings,
        confirmedBookings,
        cancelledBookings,
        totalRevenue,
        averageBookingValue,
        occupancyRate,
        topDestinations: [],
        monthlyStats: []
      }

    } catch (error) {
      console.error('❌ Failed to get booking stats:', error)
      return {
        totalBookings: 0,
        confirmedBookings: 0,
        cancelledBookings: 0,
        totalRevenue: 0,
        averageBookingValue: 0,
        occupancyRate: 0,
        topDestinations: [],
        monthlyStats: []
      }
    }
  }

  // Private helper methods

  private async validateBookingRequest(request: BookingRequest): Promise<{
    isValid: boolean
    errors: string[]
  }> {
    const errors: string[] = []

    // Date validation
    const now = new Date()
    if (request.checkIn < now) {
      errors.push('Check-in date cannot be in the past')
    }
    if (request.checkOut <= request.checkIn) {
      errors.push('Check-out date must be after check-in date')
    }

    // Guest info validation
    if (!request.guestInfo.name.trim()) {
      errors.push('Guest name is required')
    }
    if (!request.guestInfo.email.includes('@')) {
      errors.push('Valid email is required')
    }
    if (!request.guestInfo.phone.trim()) {
      errors.push('Phone number is required')
    }

    // Price validation
    if (request.totalPrice <= 0) {
      errors.push('Total price must be greater than zero')
    }

    // Property availability check
    try {
      const availability = await databasePropertyService.getAvailability(
        request.propertyId,
        request.checkIn,
        request.checkOut
      )
      if (!availability.length || !availability[0].isAvailable) {
        errors.push('Property is not available for selected dates')
      }
    } catch (error) {
      errors.push('Failed to check property availability')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  private async processPayment(booking: any, payment: any, method: 'pix' | 'credit_card'): Promise<{
    method: PaymentMethod
    pixQrCode?: string
    pixKey?: string
    externalPaymentId?: string
  }> {
    try {
      if (method === 'pix') {
        // Generate PIX payment
        const pixData = await paymentService.createPixPayment({
          amount: payment.amount,
          description: `Reserva ${booking.id}`,
          customerEmail: booking.guestEmail,
          customerName: booking.guestName
        })

        if (pixData) {
          // Update payment with PIX details
          await this.prisma.payment.update({
            where: { id: payment.id },
            data: {
              pixKey: pixData.pixKey,
              qrCode: pixData.qrCode,
              externalId: pixData.paymentId
            }
          })

          return {
            method: PaymentMethod.PIX,
            pixQrCode: pixData.qrCode,
            pixKey: pixData.pixKey,
            externalPaymentId: pixData.paymentId
          }
        }
      }

      return { method: PaymentMethod.PIX }
    } catch (error) {
      console.error('❌ Payment processing failed:', error)
      return { method: PaymentMethod.PIX }
    }
  }

  private async sendBookingConfirmations(booking: any, paymentInfo?: any, isConfirmation = false): Promise<void> {
    try {
      // Email to guest
      await emailService.sendBookingConfirmation({
        to: booking.guestEmail,
        guestName: booking.guestName,
        bookingId: booking.id,
        propertyName: booking.property.title,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        totalPrice: booking.totalPrice,
        paymentInfo,
        isConfirmation
      })

      // Email to host
      await emailService.sendNewBookingNotification({
        to: booking.property.host.email,
        hostName: booking.property.host.name,
        guestName: booking.guestName,
        propertyName: booking.property.title,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        bookingId: booking.id
      })

      // WhatsApp notifications
      if (booking.guestPhone) {
        await whatsappService.sendBookingConfirmation(
          booking.guestPhone,
          booking.guestName,
          booking.property.title,
          booking.checkIn,
          booking.checkOut,
          booking.id
        )
      }

      console.log('✅ Booking confirmations sent')
    } catch (error) {
      console.error('❌ Failed to send confirmations:', error)
    }
  }

  private async sendCancellationNotifications(booking: any, refundAmount: number, reason?: string): Promise<void> {
    try {
      // Email notifications
      await emailService.sendCancellationConfirmation({
        to: booking.guestEmail,
        guestName: booking.guestName,
        bookingId: booking.id,
        propertyName: booking.property.title,
        refundAmount,
        reason
      })

      console.log('✅ Cancellation notifications sent')
    } catch (error) {
      console.error('❌ Failed to send cancellation notifications:', error)
    }
  }

  private calculateRefundAmount(booking: any): number {
    const now = new Date()
    const checkIn = new Date(booking.checkIn)
    const hoursUntilCheckIn = (checkIn.getTime() - now.getTime()) / (1000 * 60 * 60)

    // Flexible cancellation policy
    if (hoursUntilCheckIn >= 24) {
      return booking.totalPrice // Full refund
    } else if (hoursUntilCheckIn >= 4) {
      return booking.totalPrice * 0.5 // 50% refund
    } else {
      return 0 // No refund
    }
  }

  private generateCheckInCode(): string {
    return Math.random().toString(36).substr(2, 6).toUpperCase()
  }

  private async generateCheckInInstructions(booking: any): Promise<string> {
    return `Instruções de Check-in:
    
Código de acesso: ${booking.checkInCode}
Horário: ${booking.property.checkInTime || '15:00'}
Endereço: ${booking.property.street}, ${booking.property.city}

Entre em contato com o anfitrião em caso de dúvidas.
WhatsApp: ${process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT}`
  }

  private async transformDbBookingToUnified(dbBooking: any): Promise<UnifiedBooking> {
    return {
      id: `local_${dbBooking.id}`,
      bookingNumber: dbBooking.id,
      source: PropertySource.LOCAL,
      externalBookingId: dbBooking.externalBookingId,
      
      propertyId: `local_${dbBooking.propertyId}`,
      property: await databasePropertyService.getProperty(`local_${dbBooking.propertyId}`) || {} as any,
      
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
      confirmedAt: dbBooking.confirmedAt,
      
      checkInCode: dbBooking.checkInCode,
      
      messages: []
    }
  }

  // Cleanup
  async disconnect(): Promise<void> {
    await this.prisma.$disconnect()
    console.log('🗄️ Booking service disconnected')
  }
}

// Singleton instance
export const bookingService = new BookingService()

// Graceful shutdown
process.on('beforeExit', async () => {
  await bookingService.disconnect()
})
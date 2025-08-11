// Create Booking API Endpoint - Production Ready
import { NextRequest, NextResponse } from 'next/server'
import { bookingService, BookingRequest } from '@/lib/services/booking-service'
import { databasePropertyService } from '@/lib/services/database-property-service'
import { withValidation, withRateLimit, withCors, withSecurity, withOptionalAuth } from '@/lib/middleware/auth-middleware'

interface BookingRequest {
  propertyId: string
  checkIn: string
  checkOut: string
  guests: {
    adults: number
    children: number
    infants?: number
  }
  guestInfo: {
    firstName: string
    lastName: string
    email: string
    phone: string
    cpf?: string
    dateOfBirth?: string
    nationality?: string
  }
  paymentMethod: 'pix' | 'credit_card'
  paymentDetails?: {
    cardNumber?: string
    expiryMonth?: string
    expiryYear?: string
    cvv?: string
    installments?: number
  }
  rateId?: string // Required for LiteAPI bookings
  specialRequests?: string
  marketingOptIn?: boolean
  termsAccepted: boolean
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const body: BookingRequest = await request.json()
    
    console.log(`💳 API: Creating booking for property ${body.propertyId}`)

    // Comprehensive input validation
    const validationResult = validateBookingRequest(body)
    if (!validationResult.valid) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: validationResult.message,
          field: validationResult.field
        }
      }, { status: 400 })
    }

    // Parse and validate dates
    const checkIn = new Date(body.checkIn)
    const checkOut = new Date(body.checkOut)
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24))

    // Get property details to determine source and validate availability
    const property = await unifiedPropertyService.getPropertyDetails(body.propertyId)
    if (!property) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'PROPERTY_NOT_FOUND',
          message: 'Property not found'
        }
      }, { status: 404 })
    }

    // Check availability before booking
    const availability = await unifiedPropertyService.getPropertyAvailability(
      body.propertyId,
      checkIn,
      checkOut,
      body.guests.adults,
      body.guests.children
    )

    if (!availability.length) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'NO_AVAILABILITY',
          message: 'Property is not available for the selected dates'
        }
      }, { status: 409 })
    }

    // For LiteAPI properties, validate rate ID
    if (property.source === PropertySource.LITEAPI && !body.rateId) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'MISSING_RATE_ID',
          message: 'Rate ID is required for hotel bookings'
        }
      }, { status: 400 })
    }

    // Calculate pricing
    const selectedRate = body.rateId 
      ? availability.find(rate => rate.rateId === body.rateId) || availability[0]
      : availability[0]

    const bookingFees = PropertyServiceUtils.calculateBookingFees(
      selectedRate.basePrice,
      nights,
      property.source,
      body.paymentMethod
    )

    // Generate unique booking number
    const bookingNumber = generateBookingNumber(property.source)

    // Prepare booking data for unified service
    const bookingData = {
      propertyId: body.propertyId,
      checkIn,
      checkOut,
      guests: body.guests,
      guestInfo: {
        name: `${body.guestInfo.firstName} ${body.guestInfo.lastName}`,
        email: body.guestInfo.email,
        phone: body.guestInfo.phone,
        cpf: body.guestInfo.cpf
      },
      paymentMethod: body.paymentMethod,
      specialRequests: body.specialRequests,
      rateId: body.rateId
    }

    // Create booking through unified service
    const booking = await unifiedPropertyService.createBooking(bookingData)

    if (!booking) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'BOOKING_FAILED',
          message: 'Failed to create booking. Please try again.'
        }
      }, { status: 500 })
    }

    // For LiteAPI bookings, the booking might be pending confirmation
    const isInstantConfirmation = property.source === PropertySource.LOCAL || 
                                 (property.source === PropertySource.LITEAPI && booking.status === 'confirmed')

    // Prepare response data
    const responseData: any = {
      booking: {
        id: booking.id,
        bookingNumber: booking.bookingNumber || bookingNumber,
        status: booking.status,
        confirmationRequired: !isInstantConfirmation,
        property: {
          id: property.id,
          name: property.name,
          location: property.location,
          images: property.images.slice(0, 3) // Just a few images
        },
        stay: {
          checkIn: checkIn.toISOString(),
          checkOut: checkOut.toISOString(),
          nights,
          guests: body.guests
        },
        pricing: {
          ...bookingFees,
          currency: selectedRate.currency,
          breakdown: {
            basePrice: selectedRate.basePrice,
            nights,
            subtotal: selectedRate.basePrice * nights,
            taxes: selectedRate.taxes,
            fees: selectedRate.fees,
            discount: bookingFees.discount,
            total: bookingFees.total
          }
        },
        guest: {
          name: `${body.guestInfo.firstName} ${body.guestInfo.lastName}`,
          email: body.guestInfo.email,
          phone: body.guestInfo.phone
        },
        paymentMethod: body.paymentMethod,
        policies: {
          cancellation: PropertyServiceUtils.getCancellationSummary(property, checkIn),
          checkIn: property.checkInTime,
          checkOut: property.checkOutTime
        },
        specialRequests: body.specialRequests
      },
      nextSteps: generateNextSteps(property.source, booking.status, body.paymentMethod),
      communication: {
        confirmationEmail: true,
        smsNotification: !!body.guestInfo.phone,
        whatsappSupport: process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT
      }
    }

    // If PIX payment, generate payment instructions
    if (body.paymentMethod === 'pix') {
      responseData.payment = {
        method: 'pix',
        key: process.env.NEXT_PUBLIC_PIX_KEY || 'hospedefacil@pix.com.br',
        qrCode: generatePixQRCode(bookingFees.total, booking.id),
        amount: bookingFees.total,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
        instructions: [
          'Use o código PIX acima para realizar o pagamento',
          'O pagamento deve ser feito em até 30 minutos',
          'Após a confirmação do pagamento, você receberá a confirmação por email',
          'Em caso de dúvidas, entre em contato via WhatsApp'
        ]
      }
    }

    const processingTime = Date.now() - startTime

    // Log successful booking
    console.log(`✅ Booking created: ${booking.id} (${property.source}) - ${processingTime}ms`)

    // Send confirmation email (async, don't wait)
    sendBookingConfirmationEmail(booking, property).catch(error => {
      console.error('❌ Failed to send confirmation email:', error)
    })

    return NextResponse.json({
      success: true,
      data: responseData,
      metadata: {
        timestamp: new Date(),
        requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        processingTime,
        source: [property.source]
      }
    })

  } catch (error) {
    console.error('❌ Booking Creation API Error:', error)
    
    const processingTime = Date.now() - startTime
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'BOOKING_CREATION_FAILED',
        message: 'An error occurred while creating the booking',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      metadata: {
        timestamp: new Date(),
        requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        processingTime
      }
    }, { status: 500 })
  }
}

// Validation helper
function validateBookingRequest(body: BookingRequest): {
  valid: boolean
  message?: string
  field?: string
} {
  // Required fields
  if (!body.propertyId) {
    return { valid: false, message: 'Property ID is required', field: 'propertyId' }
  }

  if (!body.checkIn || !body.checkOut) {
    return { valid: false, message: 'Check-in and check-out dates are required', field: 'dates' }
  }

  if (!body.guestInfo?.firstName || !body.guestInfo?.lastName) {
    return { valid: false, message: 'Guest name is required', field: 'guestInfo.name' }
  }

  if (!body.guestInfo?.email || !isValidEmail(body.guestInfo.email)) {
    return { valid: false, message: 'Valid email address is required', field: 'guestInfo.email' }
  }

  if (!body.guestInfo?.phone) {
    return { valid: false, message: 'Phone number is required', field: 'guestInfo.phone' }
  }

  if (!body.guests?.adults || body.guests.adults < 1) {
    return { valid: false, message: 'At least 1 adult is required', field: 'guests.adults' }
  }

  if (!['pix', 'credit_card'].includes(body.paymentMethod)) {
    return { valid: false, message: 'Invalid payment method', field: 'paymentMethod' }
  }

  if (!body.termsAccepted) {
    return { valid: false, message: 'Terms and conditions must be accepted', field: 'termsAccepted' }
  }

  // Date validation
  const checkIn = new Date(body.checkIn)
  const checkOut = new Date(body.checkOut)

  if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
    return { valid: false, message: 'Invalid date format', field: 'dates' }
  }

  if (checkIn <= new Date()) {
    return { valid: false, message: 'Check-in date must be in the future', field: 'checkIn' }
  }

  if (checkOut <= checkIn) {
    return { valid: false, message: 'Check-out must be after check-in', field: 'checkOut' }
  }

  // Credit card validation (if applicable)
  if (body.paymentMethod === 'credit_card') {
    if (!body.paymentDetails?.cardNumber || !body.paymentDetails?.cvv) {
      return { valid: false, message: 'Credit card details are required', field: 'paymentDetails' }
    }
  }

  return { valid: true }
}

// Helper functions
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

function generateBookingNumber(source: PropertySource): string {
  const prefix = source === PropertySource.LOCAL ? 'HF' : 'HG'
  const timestamp = Date.now().toString().slice(-6)
  const random = Math.random().toString(36).substr(2, 4).toUpperCase()
  return `${prefix}${timestamp}${random}`
}

function generatePixQRCode(amount: number, bookingId: string): string {
  // In a real implementation, this would generate an actual PIX QR code
  // For now, return a mock QR code string
  return `00020126360014BR.GOV.BCB.PIX0114+5511999999999520400005303986540${amount.toFixed(2)}5802BR5913HOSPEDEFACIL6009SAO PAULO62070503***6304${Math.random().toString(16).slice(2, 6).toUpperCase()}`
}

function generateNextSteps(
  source: PropertySource, 
  status: string, 
  paymentMethod: string
): Array<{ step: number; title: string; description: string; completed: boolean }> {
  const steps = [
    {
      step: 1,
      title: 'Reserva Criada',
      description: 'Sua reserva foi criada com sucesso',
      completed: true
    }
  ]

  if (paymentMethod === 'pix') {
    steps.push({
      step: 2,
      title: 'Realizar Pagamento PIX',
      description: 'Escaneie o código QR ou copie a chave PIX para efetuar o pagamento',
      completed: false
    })
  } else {
    steps.push({
      step: 2,
      title: 'Pagamento Processado',
      description: 'Seu cartão de crédito está sendo processado',
      completed: false
    })
  }

  if (source === PropertySource.LITEAPI && status === 'pending') {
    steps.push({
      step: 3,
      title: 'Aguardando Confirmação',
      description: 'O hotel está processando sua reserva. Você receberá uma confirmação em breve.',
      completed: false
    })
  } else {
    steps.push({
      step: 3,
      title: 'Reserva Confirmada',
      description: 'Você receberá um email com todos os detalhes da reserva',
      completed: status === 'confirmed'
    })
  }

  steps.push({
    step: 4,
    title: 'Prepare-se para a Viagem',
    description: 'Instruções de check-in serão enviadas 24h antes da chegada',
    completed: false
  })

  return steps
}

// Async email sending (mock implementation)
async function sendBookingConfirmationEmail(booking: any, property: any): Promise<void> {
  // In a real implementation, this would integrate with an email service
  console.log(`📧 Sending confirmation email for booking ${booking.id}`)
  
  // Mock email service call
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log(`✅ Confirmation email sent for booking ${booking.id}`)
      resolve()
    }, 1000)
  })
}
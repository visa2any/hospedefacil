// PIX Payment Creation API - Production Ready
// Integrates with MercadoPago for real PIX payments

import { NextRequest, NextResponse } from 'next/server'
import { paymentService } from '@/lib/services/payment-service'
import { withAuth, withValidation, withRateLimit, withCors, withSecurity } from '@/lib/middleware/auth-middleware'

interface CreatePixPaymentRequest {
  bookingId: string
  amount: number
  description: string
  customerInfo: {
    name: string
    email: string
    cpf?: string
  }
  expirationMinutes?: number
}

// Validation schema
function validatePixPaymentRequest(data: any): {
  isValid: boolean
  errors: string[]
  data?: CreatePixPaymentRequest
} {
  const errors: string[] = []

  // Required fields
  if (!data.bookingId?.trim()) {
    errors.push('Booking ID is required')
  }

  if (!data.amount || data.amount <= 0) {
    errors.push('Amount must be greater than zero')
  }

  if (!data.description?.trim()) {
    errors.push('Payment description is required')
  }

  // Customer info validation
  if (!data.customerInfo || typeof data.customerInfo !== 'object') {
    errors.push('Customer information is required')
  } else {
    if (!data.customerInfo.name?.trim()) {
      errors.push('Customer name is required')
    }
    if (!data.customerInfo.email?.trim() || !data.customerInfo.email.includes('@')) {
      errors.push('Valid customer email is required')
    }
    if (data.customerInfo.cpf && !/^\d{11}$/.test(data.customerInfo.cpf.replace(/\D/g, ''))) {
      errors.push('Invalid CPF format')
    }
  }

  // Optional validation
  if (data.expirationMinutes && (data.expirationMinutes < 1 || data.expirationMinutes > 1440)) {
    errors.push('Expiration must be between 1 and 1440 minutes')
  }

  // Business rules
  if (data.amount && data.amount > 10000) {
    errors.push('Maximum PIX amount is R$ 10,000.00')
  }

  if (data.amount && data.amount < 1) {
    errors.push('Minimum PIX amount is R$ 1.00')
  }

  return {
    isValid: errors.length === 0,
    errors,
    data: errors.length === 0 ? data : undefined
  }
}

async function createPixPaymentHandler(
  request: NextRequest,
  user: any,
  validatedData: CreatePixPaymentRequest
) {
  try {
    console.log('💳 Creating PIX payment for booking:', validatedData.bookingId)

    // Create PIX payment via MercadoPago
    const pixPayment = await paymentService.createPixPayment({
      amount: validatedData.amount,
      description: validatedData.description,
      customerName: validatedData.customerInfo.name,
      customerEmail: validatedData.customerInfo.email,
      customerCpf: validatedData.customerInfo.cpf,
      expirationMinutes: validatedData.expirationMinutes || 30
    })

    if (!pixPayment) {
      return NextResponse.json(
        {
          success: false,
          error: 'Payment creation failed',
          message: 'Unable to create PIX payment. Please try again.'
        },
        { status: 500 }
      )
    }

    console.log('✅ PIX payment created:', pixPayment.paymentId)

    // Return PIX payment details
    return NextResponse.json({
      success: true,
      message: 'PIX payment created successfully',
      data: {
        payment: {
          id: pixPayment.paymentId,
          status: pixPayment.status,
          method: 'PIX',
          amount: validatedData.amount,
          currency: 'BRL',
          expiresAt: pixPayment.expiresAt,
          createdAt: new Date()
        },
        pix: {
          key: pixPayment.pixKey,
          qrCode: pixPayment.qrCode,
          qrCodeBase64: pixPayment.qrCodeBase64
        },
        instructions: [
          'Abra o aplicativo do seu banco',
          'Escolha a opção PIX',
          'Escaneie o código QR ou cole a chave PIX',
          'Confirme o pagamento',
          'Aguarde a confirmação que será enviada por email'
        ]
      }
    }, { status: 201 })

  } catch (error) {
    console.error('❌ PIX payment creation failed:', error)

    if (error.message.includes('amount')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid amount',
          message: 'The payment amount is invalid or exceeds limits.'
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Payment service error',
        message: 'Unable to process PIX payment. Please try again later.'
      },
      { status: 500 }
    )
  }
}

// Apply middleware chain
const handler = withSecurity(
  withCors(
    withRateLimit(
      withAuth(
        withValidation(createPixPaymentHandler, validatePixPaymentRequest),
        { requireVerification: false } // Allow unverified users to pay
      ),
      {
        maxRequests: 5, // 5 PIX creations
        windowMs: 15 * 60 * 1000, // per 15 minutes
        keyGenerator: (req) => {
          const ip = req.headers.get('x-forwarded-for') || 'anonymous'
          return `pix_create:${ip}`
        }
      }
    ),
    {
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['*'],
      methods: ['POST', 'OPTIONS'],
      headers: ['Content-Type', 'Authorization'],
      credentials: true
    }
  )
)

export { handler as POST }
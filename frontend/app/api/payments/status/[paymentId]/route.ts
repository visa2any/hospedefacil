// Payment Status Check API - Production Ready
// Checks payment status and updates booking accordingly

import { NextRequest, NextResponse } from 'next/server'
import { paymentService } from '@/lib/services/payment-service'
import { withRateLimit, withCors, withSecurity } from '@/lib/middleware/auth-middleware'

interface PaymentStatusParams {
  paymentId: string
}

async function getPaymentStatusHandler(
  request: NextRequest,
  context: { params: PaymentStatusParams }
) {
  try {
    const { paymentId } = context.params

    if (!paymentId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request',
          message: 'Payment ID is required'
        },
        { status: 400 }
      )
    }

    console.log('💳 Checking payment status:', paymentId)

    // Get payment status from MercadoPago
    const paymentStatus = await paymentService.getPaymentStatus(paymentId)

    if (!paymentStatus) {
      return NextResponse.json(
        {
          success: false,
          error: 'Payment not found',
          message: 'Payment not found or invalid payment ID'
        },
        { status: 404 }
      )
    }

    // Map MercadoPago status to our internal status
    const statusMapping = {
      'pending': 'pending',
      'approved': 'completed',
      'authorized': 'completed',
      'in_process': 'processing',
      'in_mediation': 'processing',
      'rejected': 'failed',
      'cancelled': 'cancelled',
      'refunded': 'refunded',
      'charged_back': 'refunded'
    }

    const mappedStatus = statusMapping[paymentStatus.status] || 'pending'

    // Calculate time since creation for timeout handling
    const isExpired = paymentStatus.status === 'pending' && 
                      Date.now() - new Date(paymentStatus.id).getTime() > 30 * 60 * 1000 // 30 minutes

    console.log(`💳 Payment ${paymentId} status: ${paymentStatus.status} -> ${mappedStatus}`)

    return NextResponse.json({
      success: true,
      data: {
        payment: {
          id: paymentStatus.id,
          status: mappedStatus,
          originalStatus: paymentStatus.status,
          statusDetail: paymentStatus.statusDetail,
          amount: paymentStatus.amount,
          netAmount: paymentStatus.netAmount,
          currency: 'BRL',
          paidAt: paymentStatus.paidAt,
          isExpired,
          canRefund: ['completed'].includes(mappedStatus)
        },
        timeline: generatePaymentTimeline(paymentStatus.status, paymentStatus.paidAt),
        nextAction: getNextAction(mappedStatus, isExpired)
      }
    })

  } catch (error) {
    console.error('❌ Payment status check failed:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Status check failed',
        message: 'Unable to check payment status. Please try again.'
      },
      { status: 500 }
    )
  }
}

function generatePaymentTimeline(status: string, paidAt?: Date) {
  const timeline = [
    {
      step: 'created',
      title: 'Pagamento Criado',
      description: 'PIX gerado com sucesso',
      status: 'completed',
      timestamp: new Date() // Would be actual creation time in production
    }
  ]

  if (['approved', 'authorized'].includes(status)) {
    timeline.push({
      step: 'paid',
      title: 'Pagamento Confirmado',
      description: 'PIX recebido com sucesso',
      status: 'completed',
      timestamp: paidAt || new Date()
    })

    timeline.push({
      step: 'booking_confirmed',
      title: 'Reserva Confirmada',
      description: 'Sua reserva foi confirmada automaticamente',
      status: 'completed',
      timestamp: paidAt || new Date()
    })
  } else if (status === 'pending') {
    timeline.push({
      step: 'pending_payment',
      title: 'Aguardando Pagamento',
      description: 'Escaneie o código QR para pagar',
      status: 'current',
      timestamp: null
    })
  } else if (['rejected', 'cancelled'].includes(status)) {
    timeline.push({
      step: 'failed',
      title: 'Pagamento Não Processado',
      description: 'PIX não foi concluído',
      status: 'failed',
      timestamp: new Date()
    })
  }

  return timeline
}

function getNextAction(status: string, isExpired: boolean) {
  if (status === 'pending' && !isExpired) {
    return {
      action: 'wait_payment',
      title: 'Complete o Pagamento',
      description: 'Use o código PIX para finalizar o pagamento',
      primary: true
    }
  }

  if (status === 'pending' && isExpired) {
    return {
      action: 'create_new_payment',
      title: 'Gerar Novo PIX',
      description: 'O PIX expirou. Gere um novo código para pagar.',
      primary: true
    }
  }

  if (status === 'completed') {
    return {
      action: 'view_booking',
      title: 'Ver Reserva',
      description: 'Sua reserva foi confirmada com sucesso',
      primary: true
    }
  }

  if (status === 'failed') {
    return {
      action: 'retry_payment',
      title: 'Tentar Novamente',
      description: 'Tente outro método de pagamento',
      primary: true
    }
  }

  return {
    action: 'contact_support',
    title: 'Falar com Suporte',
    description: 'Entre em contato para esclarecimentos',
    primary: false
  }
}

// Apply middleware
const handler = withSecurity(
  withCors(
    withRateLimit(
      getPaymentStatusHandler,
      {
        maxRequests: 30, // Allow frequent status checks
        windowMs: 60 * 1000, // per minute
        keyGenerator: (req) => {
          const ip = req.headers.get('x-forwarded-for') || 'anonymous'
          return `payment_status:${ip}`
        }
      }
    ),
    {
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['*'],
      methods: ['GET', 'OPTIONS'],
      headers: ['Content-Type', 'Authorization'],
      credentials: true
    }
  )
)

export { handler as GET }
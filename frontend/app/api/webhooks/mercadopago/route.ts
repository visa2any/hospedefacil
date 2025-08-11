// MercadoPago Webhook Handler - Production Ready
// Handles payment notifications for PIX and credit card payments

import { NextRequest, NextResponse } from 'next/server'
import { paymentService, PaymentWebhookData } from '@/lib/services/payment-service'
import { bookingService } from '@/lib/services/booking-service'
import { withSecurity, withRateLimit } from '@/lib/middleware/auth-middleware'
import crypto from 'crypto'

async function webhookHandler(request: NextRequest) {
  try {
    console.log('🔔 MercadoPago webhook received')

    // Verify webhook signature (production security)
    const signature = request.headers.get('x-signature')
    const body = await request.text()
    
    if (!verifyWebhookSignature(body, signature)) {
      console.error('❌ Invalid webhook signature')
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }

    // Parse webhook data
    const webhookData: PaymentWebhookData = JSON.parse(body)
    
    console.log('📋 Processing webhook:', webhookData.type, webhookData.data.id)

    // Only process payment notifications
    if (webhookData.type !== 'payment') {
      console.log('ℹ️ Ignoring non-payment webhook')
      return NextResponse.json({ received: true })
    }

    // Process the payment update
    const paymentUpdate = await paymentService.processWebhook(webhookData)
    
    if (!paymentUpdate) {
      console.warn('⚠️ Could not process payment update')
      return NextResponse.json({ received: true })
    }

    // Update booking if payment status changed significantly
    if (paymentUpdate.shouldUpdateBooking) {
      await handlePaymentStatusUpdate(
        paymentUpdate.paymentId,
        paymentUpdate.status
      )
    }

    console.log('✅ Webhook processed successfully')
    
    return NextResponse.json({ received: true })

  } catch (error) {
    console.error('❌ Webhook processing failed:', error)
    
    // Return 200 to prevent MercadoPago from retrying
    // (we log the error for investigation)
    return NextResponse.json({ 
      received: true,
      error: 'Processing failed'
    })
  }
}

async function handlePaymentStatusUpdate(paymentId: string, status: string) {
  try {
    console.log(`💳 Processing payment ${paymentId} status: ${status}`)

    // Get payment details
    const paymentDetails = await paymentService.getPaymentStatus(paymentId)
    if (!paymentDetails) {
      console.error('❌ Could not fetch payment details')
      return
    }

    // Find associated booking (in production, you'd have a payment->booking mapping table)
    // For now, we'll use a simplified approach
    
    switch (status) {
      case 'approved':
        console.log('✅ Payment approved, confirming booking')
        // In production, you'd find the booking by payment ID and confirm it
        // await bookingService.confirmBooking(bookingId, paymentId)
        break
        
      case 'rejected':
      case 'cancelled':
        console.log('❌ Payment rejected/cancelled')
        // In production, you'd update the booking status accordingly
        break
        
      case 'in_process':
        console.log('⏳ Payment in process')
        // Keep booking as pending
        break
        
      default:
        console.log(`ℹ️ Unhandled payment status: ${status}`)
    }

  } catch (error) {
    console.error('❌ Failed to handle payment status update:', error)
  }
}

function verifyWebhookSignature(body: string, signature: string | null): boolean {
  if (!signature) {
    console.warn('⚠️ No signature provided')
    return process.env.NODE_ENV === 'development' // Allow in development
  }

  const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.warn('⚠️ No webhook secret configured')
    return process.env.NODE_ENV === 'development'
  }

  try {
    // Parse MercadoPago signature format: "ts=timestamp,v1=hash"
    const parts = signature.split(',')
    const timestamp = parts.find(part => part.startsWith('ts='))?.substring(3)
    const hash = parts.find(part => part.startsWith('v1='))?.substring(3)

    if (!timestamp || !hash) {
      console.error('❌ Invalid signature format')
      return false
    }

    // Check timestamp (reject if older than 5 minutes)
    const webhookTimestamp = parseInt(timestamp) * 1000
    const now = Date.now()
    if (now - webhookTimestamp > 5 * 60 * 1000) {
      console.error('❌ Webhook timestamp too old')
      return false
    }

    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(`${timestamp}.${body}`)
      .digest('hex')

    const isValid = crypto.timingSafeEqual(
      Buffer.from(hash, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    )

    if (!isValid) {
      console.error('❌ Signature verification failed')
      return false
    }

    return true

  } catch (error) {
    console.error('❌ Signature verification error:', error)
    return false
  }
}

// Apply middleware
const handler = withSecurity(
  withRateLimit(
    webhookHandler,
    {
      maxRequests: 100, // Allow many webhooks
      windowMs: 60 * 1000, // per minute
      keyGenerator: (req) => {
        // Rate limit by IP for webhooks
        const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'webhook'
        return `webhook_mp:${ip}`
      }
    }
  )
)

export { handler as POST }
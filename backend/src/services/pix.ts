import axios from 'axios'
import crypto from 'crypto'
import { config } from '@/config/environment.js'
import { prisma } from '@/config/database.js'

interface PIXPaymentRequest {
  amount: number
  description: string
  bookingId: string
  payerEmail: string
  payerName: string
  expiresIn?: number // seconds, default 30 minutes
}

interface PIXPaymentResponse {
  txid: string
  pixKey: string
  qrCode: string
  qrCodeImage: string
  expiresAt: Date
  amount: number
}

interface PIXWebhookPayload {
  txid: string
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
  amount: number
  payerDocument: string
  payerName: string
  timestamp: string
  endToEndId?: string
}

export class PIXService {
  private baseURL: string
  private clientId: string
  private clientSecret: string
  private accessToken: string | null = null
  private tokenExpiresAt: Date | null = null

  constructor() {
    // Using Mercado Pago as primary provider (most popular in Brazil)
    this.baseURL = config.NODE_ENV === 'production' 
      ? 'https://api.mercadopago.com' 
      : 'https://api.mercadopago.com' // Sandbox URL same as production for MP
    this.clientId = config.MERCADO_PAGO_CLIENT_ID || ''
    this.clientSecret = config.MERCADO_PAGO_CLIENT_SECRET || ''
  }

  // Authenticate with Mercado Pago
  private async authenticate(): Promise<string> {
    if (this.accessToken && this.tokenExpiresAt && new Date() < this.tokenExpiresAt) {
      return this.accessToken
    }

    try {
      // For Mercado Pago, we use the access token directly (no OAuth flow needed)
      // The access token is provided directly from the Mercado Pago dashboard
      this.accessToken = config.MERCADO_PAGO_ACCESS_TOKEN || this.clientSecret
      this.tokenExpiresAt = new Date(Date.now() + (24 * 60 * 60 * 1000)) // Valid for 24 hours
      
      // Test the token by making a test API call
      await axios.get(`${this.baseURL}/v1/payment_methods`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      })
      
      return this.accessToken

    } catch (error) {
      console.error('Mercado Pago authentication failed:', error)
      throw new Error('Falha na autenticação com Mercado Pago')
    }
  }

  // Create PIX payment using Mercado Pago
  async createPayment(paymentData: PIXPaymentRequest): Promise<PIXPaymentResponse | null> {
    try {
      const token = await this.authenticate()
      const expirationTime = paymentData.expiresIn || 1800 // 30 minutes default
      const expirationDate = new Date(Date.now() + (expirationTime * 1000))

      // Mercado Pago Payment Creation
      const paymentPayload = {
        transaction_amount: paymentData.amount,
        payment_method_id: 'pix',
        description: paymentData.description,
        external_reference: paymentData.bookingId,
        payer: {
          email: paymentData.payerEmail,
          first_name: paymentData.payerName.split(' ')[0],
          last_name: paymentData.payerName.split(' ').slice(1).join(' ') || 'Guest'
        },
        date_of_expiration: expirationDate.toISOString(),
        notification_url: `${config.API_URL}/api/webhooks/mercadopago`,
        metadata: {
          booking_id: paymentData.bookingId,
          platform: 'HospedeFacil',
          payment_type: 'accommodation'
        }
      }

      const response = await axios.post(
        `${this.baseURL}/v1/payments`,
        paymentPayload,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-Idempotency-Key': this.generateTxId() // Prevent duplicate payments
          }
        }
      )

      const paymentData_response = response.data

      if (paymentData_response && paymentData_response.status === 'pending') {
        return {
          txid: paymentData_response.id.toString(),
          pixKey: this.getPixKey(),
          qrCode: paymentData_response.point_of_interaction.transaction_data.qr_code,
          qrCodeImage: paymentData_response.point_of_interaction.transaction_data.qr_code_base64 || '',
          expiresAt: expirationDate,
          amount: paymentData.amount
        }
      }

      return null

    } catch (error) {
      console.error('PIX payment creation failed:', error)
      if (error.response?.data) {
        console.error('Mercado Pago error:', error.response.data)
      }
      throw new Error('Não foi possível criar o pagamento PIX')
    }
  }

  // Check payment status using Mercado Pago
  async checkPaymentStatus(txid: string): Promise<PIXWebhookPayload | null> {
    try {
      const token = await this.authenticate()

      const response = await axios.get(
        `${this.baseURL}/v1/payments/${txid}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      )

      if (response.data) {
        return {
          txid: response.data.id.toString(),
          status: this.mapMercadoPagoStatus(response.data.status),
          amount: parseFloat(response.data.transaction_amount || '0'),
          payerDocument: response.data.payer?.identification?.number || '',
          payerName: `${response.data.payer?.first_name || ''} ${response.data.payer?.last_name || ''}`.trim(),
          timestamp: response.data.date_created || new Date().toISOString(),
          endToEndId: response.data.point_of_interaction?.transaction_data?.e2e_id
        }
      }

      return null

    } catch (error) {
      console.error('Mercado Pago status check failed:', error)
      return null
    }
  }

  // Process PIX webhook
  async processWebhook(payload: PIXWebhookPayload): Promise<boolean> {
    try {
      console.log('Processing PIX webhook:', payload)

      // Find payment in database
      const payment = await prisma.payment.findFirst({
        where: {
          pixId: payload.txid,
          method: 'PIX'
        },
        include: {
          booking: {
            include: {
              property: {
                include: {
                  host: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                    }
                  }
                }
              },
              guest: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                }
              }
            }
          }
        }
      })

      if (!payment) {
        console.error('Payment not found for txid:', payload.txid)
        return false
      }

      // Update payment status
      const newStatus = this.mapWebhookStatus(payload.status)
      
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: newStatus,
          processedAt: new Date(),
          metadata: {
            ...payment.metadata,
            webhook: payload
          }
        }
      })

      // Update booking status if payment completed
      if (payload.status === 'COMPLETED') {
        await prisma.booking.update({
          where: { id: payment.bookingId },
          data: { status: 'CONFIRMED' }
        })

        // Send confirmation notifications
        await this.sendPaymentNotifications(payment.booking)
        
        // Update host profile earnings
        await prisma.hostProfile.update({
          where: { userId: payment.booking.property.host.id },
          data: {
            totalEarnings: { increment: payment.amount },
            totalBookings: { increment: 1 }
          }
        })

        // Update property stats
        await prisma.property.update({
          where: { id: payment.booking.propertyId },
          data: {
            totalBookings: { increment: 1 },
            totalEarnings: { increment: payment.amount }
          }
        })
      }

      // Handle failed payments
      if (payload.status === 'FAILED' || payload.status === 'CANCELLED') {
        await prisma.booking.update({
          where: { id: payment.bookingId },
          data: { status: 'CANCELLED' }
        })
      }

      return true

    } catch (error) {
      console.error('PIX webhook processing failed:', error)
      return false
    }
  }

  // Refund PIX payment
  async refundPayment(txid: string, amount: number): Promise<boolean> {
    try {
      const token = await this.authenticate()
      const refundId = this.generateTxId()

      const refundPayload = {
        valor: amount.toFixed(2),
        natureza: 'DEVOLUCAO',
        descricao: `Reembolso referente ao pagamento ${txid}`,
        solicitacaoPagador: 'Cancelamento de reserva - HospedeFácil'
      }

      const response = await axios.put(
        `${this.baseURL}/v2/cob/${txid}/devolucao/${refundId}`,
        refundPayload,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      )

      return response.status === 201

    } catch (error) {
      console.error('PIX refund failed:', error)
      return false
    }
  }

  // Generate PIX payment link
  async generatePaymentLink(paymentData: PIXPaymentRequest): Promise<string | null> {
    try {
      const pixPayment = await this.createPayment(paymentData)
      
      if (pixPayment) {
        // Create a payment page URL
        const paymentUrl = `${config.FRONTEND_URL}/payment/${pixPayment.txid}`
        return paymentUrl
      }

      return null

    } catch (error) {
      console.error('PIX payment link generation failed:', error)
      return null
    }
  }

  // Validate PIX key format
  static validatePixKey(pixKey: string, type: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random'): boolean {
    switch (type) {
      case 'cpf':
        return /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(pixKey)
      case 'cnpj':
        return /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(pixKey)
      case 'email':
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pixKey)
      case 'phone':
        return /^\+55\d{2}\d{8,9}$/.test(pixKey)
      case 'random':
        return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(pixKey)
      default:
        return false
    }
  }

  // Calculate PIX fees
  static calculateFees(amount: number): { pixFee: number, netAmount: number } {
    // PIX typically has very low fees, often free for end users
    const pixFee = 0 // Most PIX transactions are free
    const netAmount = amount - pixFee

    return { pixFee, netAmount }
  }

  // Generate instant payment notification
  generateInstantPaymentText(amount: number, description: string): string {
    return `💰 *Pagamento PIX - HospedeFácil*

💵 *Valor:* R$ ${amount.toFixed(2)}
📝 *Descrição:* ${description}

⚡ *Pagamento instantâneo via PIX*
🔒 *Seguro e protegido*
✅ *Confirmação automática*

_Pague com seu app de banco preferido!_`
  }

  // Helper methods
  private generateTxId(): string {
    return crypto.randomBytes(16).toString('hex').substring(0, 25)
  }

  private getPixKey(): string {
    // Return your PIX key - could be CPF, CNPJ, email, phone, or random key
    return process.env.PIX_KEY || 'contato@hospedefacil.com.br'
  }

  private extractCPF(email: string): string {
    // This is a placeholder - in real implementation, you'd get CPF from user profile
    // For demo purposes, we'll return a placeholder
    return '12345678901'
  }

  private mapPixStatus(status: string): 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' {
    switch (status.toUpperCase()) {
      case 'ATIVA':
        return 'PENDING'
      case 'CONCLUIDA':
        return 'COMPLETED'
      case 'REMOVIDA_PELO_USUARIO_RECEBEDOR':
      case 'REMOVIDA_PELO_PSP':
        return 'CANCELLED'
      default:
        return 'PENDING'
    }
  }

  private mapMercadoPagoStatus(status: string): 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' {
    switch (status.toLowerCase()) {
      case 'approved':
        return 'COMPLETED'
      case 'pending':
        return 'PENDING'
      case 'in_process':
        return 'PROCESSING'
      case 'rejected':
        return 'FAILED'
      case 'cancelled':
        return 'CANCELLED'
      case 'refunded':
        return 'CANCELLED'
      default:
        return 'PENDING'
    }
  }

  private mapWebhookStatus(status: string): 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' {
    switch (status.toUpperCase()) {
      case 'COMPLETED':
        return 'COMPLETED'
      case 'FAILED':
        return 'FAILED'
      case 'CANCELLED':
        return 'CANCELLED'
      case 'PROCESSING':
        return 'PROCESSING'
      default:
        return 'PENDING'
    }
  }

  private async sendPaymentNotifications(booking: any): Promise<void> {
    try {
      // This would integrate with your email and WhatsApp services
      console.log(`Sending payment confirmation for booking ${booking.id}`)
      
      // Example: Send email confirmation
      // await emailService.sendPaymentConfirmation(booking)
      
      // Example: Send WhatsApp notification
      // await whatsappService.sendPaymentConfirmation(booking)
      
    } catch (error) {
      console.error('Failed to send payment notifications:', error)
    }
  }

  // PIX payment monitoring
  async monitorPaymentStatus(txid: string, timeoutMinutes: number = 30): Promise<void> {
    const maxAttempts = timeoutMinutes * 2 // Check every 30 seconds
    let attempts = 0

    const checkStatus = async () => {
      const status = await this.checkPaymentStatus(txid)
      
      if (status && (status.status === 'COMPLETED' || status.status === 'FAILED')) {
        await this.processWebhook(status)
        return
      }

      attempts++
      if (attempts < maxAttempts) {
        setTimeout(checkStatus, 30000) // Check again in 30 seconds
      } else {
        // Timeout - mark payment as expired
        await prisma.payment.updateMany({
          where: { pixId: txid },
          data: { status: 'CANCELLED' }
        })
      }
    }

    // Start monitoring
    setTimeout(checkStatus, 10000) // First check after 10 seconds
  }

  // Generate PIX payment summary for receipt
  generatePaymentSummary(payment: any, booking: any): any {
    return {
      transactionId: payment.pixId,
      amount: payment.amount,
      currency: 'BRL',
      method: 'PIX',
      status: payment.status,
      createdAt: payment.createdAt,
      processedAt: payment.processedAt,
      booking: {
        id: booking.id,
        property: booking.property.title,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        nights: booking.nights,
        guests: booking.guests,
      },
      fees: {
        pixFee: 0, // PIX is typically free
        serviceFee: booking.serviceFee,
        taxes: booking.taxes,
        cleaningFee: booking.cleaningFee,
      },
      breakdown: {
        accommodation: booking.basePrice * booking.nights,
        cleaningFee: booking.cleaningFee,
        serviceFee: booking.serviceFee,
        taxes: booking.taxes,
        total: booking.totalPrice,
      }
    }
  }
}
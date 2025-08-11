// Real Payment Service - PIX and Credit Card Processing
// Integrates with Mercado Pago for production-ready payments

import axios from 'axios'

export interface PixPaymentRequest {
  amount: number
  description: string
  customerEmail: string
  customerName: string
  customerCpf?: string
  expirationMinutes?: number
}

export interface PixPaymentResponse {
  paymentId: string
  pixKey: string
  qrCode: string
  qrCodeBase64: string
  expiresAt: Date
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
}

export interface CreditCardPaymentRequest {
  amount: number
  description: string
  customerEmail: string
  customerName: string
  customerCpf?: string
  cardToken: string
  installments?: number
}

export interface PaymentWebhookData {
  id: string
  action: string
  api_version: string
  data: {
    id: string
  }
  date_created: string
  live_mode: boolean
  type: string
  user_id: string
}

export class PaymentService {
  private mercadoPagoAccessToken: string
  private mercadoPagoPublicKey: string
  private baseUrl = 'https://api.mercadopago.com/v1'

  constructor() {
    this.mercadoPagoAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN || ''
    this.mercadoPagoPublicKey = process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY || ''

    if (!this.mercadoPagoAccessToken) {
      console.warn('⚠️ MercadoPago access token not configured')
    }
  }

  // Create PIX payment
  async createPixPayment(request: PixPaymentRequest): Promise<PixPaymentResponse | null> {
    try {
      console.log('💳 Creating PIX payment:', { 
        amount: request.amount, 
        customer: request.customerEmail 
      })

      const paymentData = {
        transaction_amount: request.amount,
        description: request.description,
        payment_method_id: 'pix',
        payer: {
          email: request.customerEmail,
          first_name: request.customerName.split(' ')[0],
          last_name: request.customerName.split(' ').slice(1).join(' ') || 'Cliente',
          ...(request.customerCpf && {
            identification: {
              type: 'CPF',
              number: request.customerCpf.replace(/\D/g, '')
            }
          })
        },
        date_of_expiration: new Date(
          Date.now() + (request.expirationMinutes || 30) * 60 * 1000
        ).toISOString(),
        notification_url: `${process.env.NEXT_PUBLIC_SITE_URL}/api/webhooks/mercadopago`,
        metadata: {
          booking_service: 'hospedefacil',
          payment_type: 'pix'
        }
      }

      const response = await axios.post(
        `${this.baseUrl}/payments`,
        paymentData,
        {
          headers: {
            'Authorization': `Bearer ${this.mercadoPagoAccessToken}`,
            'Content-Type': 'application/json',
            'X-Idempotency-Key': `pix-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          }
        }
      )

      const payment = response.data

      if (!payment.id) {
        throw new Error('Invalid payment response')
      }

      console.log('✅ PIX payment created:', payment.id)

      return {
        paymentId: payment.id.toString(),
        pixKey: payment.point_of_interaction?.transaction_data?.qr_code || '',
        qrCode: payment.point_of_interaction?.transaction_data?.qr_code || '',
        qrCodeBase64: payment.point_of_interaction?.transaction_data?.qr_code_base64 || '',
        expiresAt: new Date(payment.date_of_expiration),
        status: payment.status
      }

    } catch (error) {
      console.error('❌ PIX payment creation failed:', error.response?.data || error.message)
      return null
    }
  }

  // Create credit card payment
  async createCreditCardPayment(request: CreditCardPaymentRequest): Promise<any> {
    try {
      console.log('💳 Creating credit card payment:', { 
        amount: request.amount, 
        customer: request.customerEmail 
      })

      const paymentData = {
        transaction_amount: request.amount,
        token: request.cardToken,
        description: request.description,
        installments: request.installments || 1,
        payment_method_id: 'visa', // Will be determined by token
        payer: {
          email: request.customerEmail,
          first_name: request.customerName.split(' ')[0],
          last_name: request.customerName.split(' ').slice(1).join(' ') || 'Cliente',
          ...(request.customerCpf && {
            identification: {
              type: 'CPF',
              number: request.customerCpf.replace(/\D/g, '')
            }
          })
        },
        notification_url: `${process.env.NEXT_PUBLIC_SITE_URL}/api/webhooks/mercadopago`,
        metadata: {
          booking_service: 'hospedefacil',
          payment_type: 'credit_card'
        }
      }

      const response = await axios.post(
        `${this.baseUrl}/payments`,
        paymentData,
        {
          headers: {
            'Authorization': `Bearer ${this.mercadoPagoAccessToken}`,
            'Content-Type': 'application/json',
            'X-Idempotency-Key': `cc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          }
        }
      )

      const payment = response.data
      console.log('✅ Credit card payment created:', payment.id)

      return {
        paymentId: payment.id.toString(),
        status: payment.status,
        statusDetail: payment.status_detail,
        authorizationCode: payment.authorization_code
      }

    } catch (error) {
      console.error('❌ Credit card payment creation failed:', error.response?.data || error.message)
      return null
    }
  }

  // Get payment status
  async getPaymentStatus(paymentId: string): Promise<{
    id: string
    status: string
    statusDetail: string
    amount: number
    netAmount: number
    paidAt?: Date
  } | null> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/payments/${paymentId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.mercadoPagoAccessToken}`
          }
        }
      )

      const payment = response.data

      return {
        id: payment.id.toString(),
        status: payment.status,
        statusDetail: payment.status_detail,
        amount: payment.transaction_amount,
        netAmount: payment.transaction_amount - (payment.fee_details?.reduce((sum: number, fee: any) => sum + fee.amount, 0) || 0),
        paidAt: payment.status === 'approved' ? new Date(payment.date_approved) : undefined
      }

    } catch (error) {
      console.error('❌ Failed to get payment status:', error.response?.data || error.message)
      return null
    }
  }

  // Process webhook notification
  async processWebhook(webhookData: PaymentWebhookData): Promise<{
    paymentId: string
    status: string
    shouldUpdateBooking: boolean
  } | null> {
    try {
      console.log('🔔 Processing payment webhook:', webhookData)

      if (webhookData.type !== 'payment') {
        console.log('ℹ️ Ignoring non-payment webhook')
        return null
      }

      const paymentId = webhookData.data.id
      const paymentStatus = await this.getPaymentStatus(paymentId)

      if (!paymentStatus) {
        console.error('❌ Could not fetch payment status from webhook')
        return null
      }

      const shouldUpdateBooking = ['approved', 'rejected', 'cancelled'].includes(paymentStatus.status)

      return {
        paymentId,
        status: paymentStatus.status,
        shouldUpdateBooking
      }

    } catch (error) {
      console.error('❌ Webhook processing failed:', error)
      return null
    }
  }

  // Refund payment
  async refundPayment(paymentId: string, amount?: number): Promise<boolean> {
    try {
      console.log('💸 Processing refund:', { paymentId, amount })

      const refundData: any = {}
      if (amount) {
        refundData.amount = amount
      }

      const response = await axios.post(
        `${this.baseUrl}/payments/${paymentId}/refunds`,
        refundData,
        {
          headers: {
            'Authorization': `Bearer ${this.mercadoPagoAccessToken}`,
            'Content-Type': 'application/json'
          }
        }
      )

      console.log('✅ Refund processed:', response.data.id)
      return true

    } catch (error) {
      console.error('❌ Refund failed:', error.response?.data || error.message)
      return false
    }
  }

  // Get installment options for amount
  async getInstallmentOptions(amount: number, bin: string): Promise<Array<{
    installments: number
    installmentAmount: number
    totalAmount: number
    interestRate: number
  }>> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/payment_methods/installments`,
        {
          params: {
            amount,
            payment_method_id: 'visa',
            bin
          },
          headers: {
            'Authorization': `Bearer ${this.mercadoPagoAccessToken}`
          }
        }
      )

      return response.data[0]?.payer_costs?.map((cost: any) => ({
        installments: cost.installments,
        installmentAmount: cost.installment_amount,
        totalAmount: cost.total_amount,
        interestRate: cost.installment_rate
      })) || []

    } catch (error) {
      console.error('❌ Failed to get installment options:', error)
      return []
    }
  }

  // Generate PIX static key for account
  getStaticPixKey(): string {
    return process.env.NEXT_PUBLIC_PIX_KEY || 'hospedefacil@pix.com.br'
  }

  // Format amount for display
  formatAmount(amount: number, currency = 'BRL'): string {
    try {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency
      }).format(amount)
    } catch {
      return `R$ ${amount.toFixed(2)}`
    }
  }

  // Calculate fees
  calculateFees(amount: number, method: 'pix' | 'credit_card', installments = 1): {
    platformFee: number
    gatewayFee: number
    totalFees: number
    netAmount: number
  } {
    let platformFee = 0
    let gatewayFee = 0

    if (method === 'pix') {
      // PIX: 0.99% + R$0.40
      gatewayFee = amount * 0.0099 + 0.40
    } else {
      // Credit card: 3.49% + R$0.40 (1x) or higher for installments
      const rate = installments === 1 ? 0.0349 : 0.0429
      gatewayFee = amount * rate + 0.40
    }

    // Platform fee: 3%
    platformFee = amount * 0.03

    const totalFees = platformFee + gatewayFee
    const netAmount = amount - totalFees

    return {
      platformFee,
      gatewayFee,
      totalFees,
      netAmount
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/users/me`,
        {
          headers: {
            'Authorization': `Bearer ${this.mercadoPagoAccessToken}`
          }
        }
      )
      return response.status === 200
    } catch (error) {
      console.error('❌ Payment service health check failed:', error.message)
      return false
    }
  }
}

// Singleton instance
export const paymentService = new PaymentService()
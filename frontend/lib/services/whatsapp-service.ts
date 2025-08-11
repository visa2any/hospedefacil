// WhatsApp Service - Production-ready messaging integration
// Uses WhatsApp Business API for automated notifications

import axios from 'axios'

export interface WhatsAppMessage {
  to: string
  type: 'text' | 'template' | 'image' | 'document'
  text?: {
    body: string
  }
  template?: {
    name: string
    language: {
      code: string
    }
    components: Array<{
      type: string
      parameters: Array<{
        type: string
        text: string
      }>
    }>
  }
}

export class WhatsAppService {
  private apiKey: string
  private phoneNumberId: string
  private baseUrl = 'https://graph.facebook.com/v18.0'
  private isConfigured: boolean

  constructor() {
    this.apiKey = process.env.WHATSAPP_API_KEY || ''
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || ''
    this.isConfigured = !!(this.apiKey && this.phoneNumberId)

    if (!this.isConfigured) {
      console.warn('⚠️ WhatsApp API not configured')
    }
  }

  // Send booking confirmation via WhatsApp
  async sendBookingConfirmation(
    phoneNumber: string,
    guestName: string,
    propertyName: string,
    checkIn: Date,
    checkOut: Date,
    bookingId: string
  ): Promise<boolean> {
    try {
      if (!this.isConfigured) {
        console.log('📱 WhatsApp simulation - Booking confirmation:', guestName)
        return true
      }

      const formatDate = (date: Date) => 
        new Intl.DateTimeFormat('pt-BR', { 
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        }).format(date)

      const message = `🎉 *Reserva Confirmada - HospedeFácil*

Olá ${guestName}!

Sua reserva foi confirmada com sucesso:

🏠 *Propriedade:* ${propertyName}
📅 *Check-in:* ${formatDate(checkIn)}
📅 *Check-out:* ${formatDate(checkOut)}
🔢 *Código:* #${bookingId}

📋 Acesse os detalhes completos em:
${process.env.NEXT_PUBLIC_SITE_URL}/booking/${bookingId}

❓ Dúvidas? Responda esta mensagem!

_HospedeFácil - Conectando pessoas e lugares especiais_`

      return await this.sendTextMessage(phoneNumber, message)

    } catch (error) {
      console.error('❌ Failed to send WhatsApp booking confirmation:', error)
      return false
    }
  }

  // Send payment reminder
  async sendPaymentReminder(
    phoneNumber: string,
    guestName: string,
    bookingId: string,
    pixKey?: string
  ): Promise<boolean> {
    try {
      if (!this.isConfigured) {
        console.log('📱 WhatsApp simulation - Payment reminder:', guestName)
        return true
      }

      const message = `⏰ *Lembrete de Pagamento - HospedeFácil*

Olá ${guestName}!

Sua reserva #${bookingId} está aguardando pagamento.

${pixKey ? `💳 *Chave PIX:* ${pixKey}` : ''}

⚡ Complete o pagamento para confirmar sua reserva.

📋 Acesse: ${process.env.NEXT_PUBLIC_SITE_URL}/booking/${bookingId}

_Pagamento deve ser realizado em até 30 minutos_`

      return await this.sendTextMessage(phoneNumber, message)

    } catch (error) {
      console.error('❌ Failed to send WhatsApp payment reminder:', error)
      return false
    }
  }

  // Send check-in instructions
  async sendCheckInInstructions(
    phoneNumber: string,
    guestName: string,
    propertyName: string,
    checkInCode: string,
    instructions: string
  ): Promise<boolean> {
    try {
      if (!this.isConfigured) {
        console.log('📱 WhatsApp simulation - Check-in instructions:', guestName)
        return true
      }

      const message = `🗝️ *Instruções de Check-in*

Olá ${guestName}!

Sua estadia em *${propertyName}* está chegando!

🔑 *Código de Acesso:* ${checkInCode}

📋 *Instruções:*
${instructions}

❓ Dúvidas? Responda esta mensagem!

✨ Desejamos uma excelente estadia!

_HospedeFácil - Conectando pessoas e lugares especiais_`

      return await this.sendTextMessage(phoneNumber, message)

    } catch (error) {
      console.error('❌ Failed to send WhatsApp check-in instructions:', error)
      return false
    }
  }

  // Send review request after checkout
  async sendReviewRequest(
    phoneNumber: string,
    guestName: string,
    propertyName: string,
    bookingId: string
  ): Promise<boolean> {
    try {
      if (!this.isConfigured) {
        console.log('📱 WhatsApp simulation - Review request:', guestName)
        return true
      }

      const message = `⭐ *Avalie sua Experiência*

Olá ${guestName}!

Esperamos que tenha tido uma excelente estadia em *${propertyName}*!

🌟 Sua opinião é muito importante para nós e outros hóspedes.

📝 Avalie sua experiência em:
${process.env.NEXT_PUBLIC_SITE_URL}/booking/${bookingId}/review

🎁 *Bônus:* Ganhe 50 pontos no nosso programa de fidelidade!

Obrigado por escolher o HospedeFácil! 💙

_HospedeFácil - Conectando pessoas e lugares especiais_`

      return await this.sendTextMessage(phoneNumber, message)

    } catch (error) {
      console.error('❌ Failed to send WhatsApp review request:', error)
      return false
    }
  }

  // Send cancellation notification
  async sendCancellationNotification(
    phoneNumber: string,
    guestName: string,
    bookingId: string,
    refundAmount: number
  ): Promise<boolean> {
    try {
      if (!this.isConfigured) {
        console.log('📱 WhatsApp simulation - Cancellation notification:', guestName)
        return true
      }

      const formatCurrency = (amount: number) => 
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount)

      const message = `❌ *Reserva Cancelada*

Olá ${guestName}!

Sua reserva #${bookingId} foi cancelada conforme solicitado.

${refundAmount > 0 
  ? `💰 *Reembolso:* ${formatCurrency(refundAmount)}
O valor será creditado em até 5 dias úteis.` 
  : '💰 Conforme nossa política, não haverá reembolso para este cancelamento.'
}

🔍 Que tal encontrar outro lugar incrível?
${process.env.NEXT_PUBLIC_SITE_URL}/search

❓ Dúvidas? Responda esta mensagem!

_HospedeFácil - Conectando pessoas e lugares especiais_`

      return await this.sendTextMessage(phoneNumber, message)

    } catch (error) {
      console.error('❌ Failed to send WhatsApp cancellation notification:', error)
      return false
    }
  }

  // Send promotional message
  async sendPromotion(
    phoneNumber: string,
    guestName: string,
    promotion: {
      title: string
      description: string
      discount: number
      code: string
      validUntil: Date
    }
  ): Promise<boolean> {
    try {
      if (!this.isConfigured) {
        console.log('📱 WhatsApp simulation - Promotion:', guestName)
        return true
      }

      const formatDate = (date: Date) => 
        new Intl.DateTimeFormat('pt-BR', { 
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        }).format(date)

      const message = `🎉 *${promotion.title}*

Olá ${guestName}!

${promotion.description}

💫 *Desconto:* ${promotion.discount}%
🎟️ *Código:* ${promotion.code}
⏰ *Válido até:* ${formatDate(promotion.validUntil)}

🔍 Encontre sua próxima hospedagem:
${process.env.NEXT_PUBLIC_SITE_URL}/search

_Não perca esta oportunidade!_

_HospedeFácil - Conectando pessoas e lugares especiais_`

      return await this.sendTextMessage(phoneNumber, message)

    } catch (error) {
      console.error('❌ Failed to send WhatsApp promotion:', error)
      return false
    }
  }

  // Send custom text message
  private async sendTextMessage(phoneNumber: string, text: string): Promise<boolean> {
    try {
      if (!this.isConfigured) {
        console.log('📱 WhatsApp not configured, message simulation:', { phoneNumber, text: text.substring(0, 100) })
        return true
      }

      // Clean phone number (remove non-digits and ensure format)
      const cleanNumber = phoneNumber.replace(/\D/g, '')
      const formattedNumber = cleanNumber.startsWith('55') ? cleanNumber : `55${cleanNumber}`

      const payload = {
        messaging_product: 'whatsapp',
        to: formattedNumber,
        type: 'text',
        text: {
          body: text
        }
      }

      const response = await axios.post(
        `${this.baseUrl}/${this.phoneNumberId}/messages`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (response.data.messages?.[0]?.id) {
        console.log('✅ WhatsApp message sent:', response.data.messages[0].id)
        return true
      } else {
        console.error('❌ WhatsApp message failed - no message ID returned')
        return false
      }

    } catch (error) {
      console.error('❌ WhatsApp send message failed:', error.response?.data || error.message)
      return false
    }
  }

  // Send template message (for approved templates)
  private async sendTemplateMessage(
    phoneNumber: string,
    templateName: string,
    parameters: string[] = []
  ): Promise<boolean> {
    try {
      if (!this.isConfigured) {
        console.log('📱 WhatsApp template simulation:', { phoneNumber, templateName })
        return true
      }

      const cleanNumber = phoneNumber.replace(/\D/g, '')
      const formattedNumber = cleanNumber.startsWith('55') ? cleanNumber : `55${cleanNumber}`

      const payload = {
        messaging_product: 'whatsapp',
        to: formattedNumber,
        type: 'template',
        template: {
          name: templateName,
          language: {
            code: 'pt_BR'
          },
          components: parameters.length > 0 ? [
            {
              type: 'body',
              parameters: parameters.map(param => ({
                type: 'text',
                text: param
              }))
            }
          ] : []
        }
      }

      const response = await axios.post(
        `${this.baseUrl}/${this.phoneNumberId}/messages`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (response.data.messages?.[0]?.id) {
        console.log('✅ WhatsApp template sent:', response.data.messages[0].id)
        return true
      } else {
        console.error('❌ WhatsApp template failed - no message ID returned')
        return false
      }

    } catch (error) {
      console.error('❌ WhatsApp send template failed:', error.response?.data || error.message)
      return false
    }
  }

  // Process incoming webhook
  async processWebhook(webhookData: any): Promise<{
    messageId?: string
    from: string
    text?: string
    type: string
    timestamp: number
  } | null> {
    try {
      console.log('🔔 Processing WhatsApp webhook:', webhookData)

      const entry = webhookData.entry?.[0]
      const changes = entry?.changes?.[0]
      const value = changes?.value

      if (changes?.field !== 'messages' || !value?.messages) {
        return null
      }

      const message = value.messages[0]
      const contact = value.contacts?.[0]

      return {
        messageId: message.id,
        from: message.from,
        text: message.text?.body,
        type: message.type,
        timestamp: message.timestamp
      }

    } catch (error) {
      console.error('❌ WhatsApp webhook processing failed:', error)
      return null
    }
  }

  // Get business profile
  async getBusinessProfile(): Promise<any> {
    try {
      if (!this.isConfigured) return null

      const response = await axios.get(
        `${this.baseUrl}/${this.phoneNumberId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      )

      return response.data

    } catch (error) {
      console.error('❌ Failed to get WhatsApp business profile:', error)
      return null
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.isConfigured) return false

      const profile = await this.getBusinessProfile()
      return !!profile?.id

    } catch (error) {
      console.error('❌ WhatsApp health check failed:', error)
      return false
    }
  }

  // Format phone number to WhatsApp format
  static formatPhoneNumber(phone: string): string {
    const cleanNumber = phone.replace(/\D/g, '')
    return cleanNumber.startsWith('55') ? cleanNumber : `55${cleanNumber}`
  }

  // Validate phone number format
  static isValidPhoneNumber(phone: string): boolean {
    const cleanNumber = phone.replace(/\D/g, '')
    const formatted = cleanNumber.startsWith('55') ? cleanNumber : `55${cleanNumber}`
    
    // Brazilian phone number: 55 + DDD (2 digits) + number (8 or 9 digits)
    return /^55\d{2}9?\d{8}$/.test(formatted)
  }
}

// Singleton instance
export const whatsappService = new WhatsAppService()
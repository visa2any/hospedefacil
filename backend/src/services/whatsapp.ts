import axios from 'axios'
import { config } from '@/config/environment.js'
import { prisma } from '@/config/database.js'
import { AIService } from './ai.js'

interface WhatsAppMessage {
  from: string
  body: string
  timestamp: Date
  isGroup: boolean
  author?: string
}

interface BookingNotification {
  id: string
  property: { title: string; city: string; state: string }
  checkIn: Date
  checkOut: Date
  guests: number
  totalPrice: number
  checkInCode?: string
}

export class WhatsAppService {
  private baseURL: string
  private accessToken: string
  private phoneNumberId: string
  private isReady = false
  private aiService: AIService

  constructor() {
    this.baseURL = 'https://graph.facebook.com/v18.0'
    this.accessToken = config.WHATSAPP_ACCESS_TOKEN || ''
    this.phoneNumberId = config.WHATSAPP_PHONE_NUMBER_ID || ''
    this.aiService = new AIService()
    this.isReady = !!this.accessToken && !!this.phoneNumberId
    
    if (!this.isReady) {
      console.error('❌ WhatsApp não configurado: ACCESS_TOKEN e PHONE_NUMBER_ID são obrigatórios')
    } else {
      console.log('✅ WhatsApp Business API configurado e pronto!')
    }
  }

  // Process webhook from WhatsApp Business API
  async processWebhook(webhookBody: any): Promise<void> {
    try {
      const entry = webhookBody.entry?.[0]
      const changes = entry?.changes?.[0]
      const messages = changes?.value?.messages

      if (!messages || messages.length === 0) {
        return
      }

      for (const message of messages) {
        await this.handleIncomingMessage(message, changes.value.contacts?.[0])
      }
    } catch (error) {
      console.error('Erro ao processar webhook WhatsApp:', error)
    }
  }

  // Handle incoming messages
  private async handleIncomingMessage(message: any, contact?: any): Promise<void> {
    try {
      const phoneNumber = message.from
      const messageBody = message.text?.body || message.interactive?.button_reply?.title || ''
      const messageType = message.type

      console.log(`📨 Mensagem recebida de ${phoneNumber}: ${messageBody}`)

      // Skip empty messages
      if (!messageBody || messageBody.length === 0) {
        return
      }

      // Log message to database
      await this.logMessage({
        from: phoneNumber,
        body: messageBody,
        timestamp: new Date(message.timestamp * 1000),
        isGroup: false,
      })

      // Check if user exists
      const user = await prisma.user.findFirst({
        where: { 
          OR: [
            { phone: { contains: phoneNumber.replace('55', '') } },
            { phone: { contains: phoneNumber } },
          ]
        }
      })

      // Generate AI response
      const aiResponse = await this.aiService.generateWhatsAppResponse(
        messageBody,
        phoneNumber,
        user ? {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        } : null
      )

      // Send response
      if (aiResponse) {
        await this.sendMessage(phoneNumber, aiResponse)
      }

    } catch (error) {
      console.error('Erro ao processar mensagem WhatsApp:', error)
    }
  }

  // Send text message via WhatsApp Business API
  async sendMessage(phoneNumber: string, message: string): Promise<boolean> {
    if (!this.isReady) {
      console.error('WhatsApp não está configurado')
      return false
    }

    try {
      const formattedNumber = this.formatPhoneNumber(phoneNumber)
      
      const payload = {
        messaging_product: 'whatsapp',
        to: formattedNumber,
        type: 'text',
        text: {
          body: message
        }
      }

      const response = await axios.post(
        `${this.baseURL}/${this.phoneNumberId}/messages`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      )

      console.log(`✅ Mensagem enviada para ${phoneNumber}`)
      
      // Log outbound message
      await this.logOutboundMessage(phoneNumber, message, 'text')
      
      return true

    } catch (error) {
      console.error(`❌ Erro ao enviar mensagem para ${phoneNumber}:`, error)
      return false
    }
  }

  // Send image with caption
  async sendImage(phoneNumber: string, imageUrl: string, caption?: string): Promise<boolean> {
    if (!this.isReady) {
      console.error('WhatsApp não está configurado')
      return false
    }

    try {
      const formattedNumber = this.formatPhoneNumber(phoneNumber)
      
      const payload = {
        messaging_product: 'whatsapp',
        to: formattedNumber,
        type: 'image',
        image: {
          link: imageUrl,
          caption: caption || ''
        }
      }

      await axios.post(
        `${this.baseURL}/${this.phoneNumberId}/messages`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      )

      console.log(`✅ Imagem enviada para ${phoneNumber}`)
      await this.logOutboundMessage(phoneNumber, caption || 'Imagem', 'image')
      
      return true

    } catch (error) {
      console.error(`❌ Erro ao enviar imagem para ${phoneNumber}:`, error)
      return false
    }
  }

  // Send interactive buttons
  async sendButtons(phoneNumber: string, message: string, buttons: Array<{id: string, title: string}>): Promise<boolean> {
    if (!this.isReady) {
      console.error('WhatsApp não está configurado')
      return false
    }

    try {
      const formattedNumber = this.formatPhoneNumber(phoneNumber)
      
      const payload = {
        messaging_product: 'whatsapp',
        to: formattedNumber,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: {
            text: message
          },
          action: {
            buttons: buttons.map((button, index) => ({
              type: 'reply',
              reply: {
                id: button.id,
                title: button.title
              }
            }))
          }
        }
      }

      await axios.post(
        `${this.baseURL}/${this.phoneNumberId}/messages`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      )

      console.log(`✅ Mensagem interativa enviada para ${phoneNumber}`)
      await this.logOutboundMessage(phoneNumber, message, 'interactive')
      
      return true

    } catch (error) {
      console.error(`❌ Erro ao enviar mensagem interativa para ${phoneNumber}:`, error)
      return false
    }
  }

  // Send welcome message
  async sendWelcomeMessage(phoneNumber: string, userName: string): Promise<boolean> {
    const message = `🎉 *Bem-vindo(a) ao HospedeFácil, ${userName}!*

Obrigado por se cadastrar na plataforma de hospedagem mais avançada do Brasil!

🏠 *O que você pode fazer:*
• Buscar propriedades incríveis
• Fazer reservas instantâneas via PIX
• Conversar com anfitriões
• Avaliar suas experiências

💬 *Como posso ajudar?*
Digite qualquer pergunta ou use os comandos:
• *#buscar [cidade]* - Encontrar propriedades
• *#reservas* - Ver suas reservas
• *#ajuda* - Lista completa de comandos
• *#suporte* - Falar com atendimento

✨ *Hospede-se com facilidade!*`

    return await this.sendMessage(phoneNumber, message)
  }

  // Send booking confirmation
  async sendBookingConfirmation(phoneNumber: string, booking: BookingNotification): Promise<boolean> {
    const checkInDate = booking.checkIn.toLocaleDateString('pt-BR')
    const checkOutDate = booking.checkOut.toLocaleDateString('pt-BR')

    const message = `🎉 *Reserva Confirmada - HospedeFácil*

✅ *Sua reserva foi criada com sucesso!*

🏠 *Propriedade:* ${booking.property.title}
📍 *Local:* ${booking.property.city}, ${booking.property.state}
📅 *Check-in:* ${checkInDate}
📅 *Check-out:* ${checkOutDate}
👥 *Hóspedes:* ${booking.guests} pessoa${booking.guests > 1 ? 's' : ''}
💰 *Total:* R$ ${booking.totalPrice.toFixed(2)}

📱 *Próximos passos:*
1. Aguarde a confirmação do pagamento PIX
2. Receba o código de check-in
3. Entre em contato com o anfitrião se necessário

🔗 *Ver detalhes:* hospedefacil.com.br/booking/${booking.id}

💬 *Dúvidas?* Responda esta mensagem que te ajudo!`

    return await this.sendMessage(phoneNumber, message)
  }

  // Send booking confirmed (after payment)
  async sendBookingConfirmed(phoneNumber: string, booking: any): Promise<boolean> {
    const checkInDate = booking.checkIn.toLocaleDateString('pt-BR')
    const checkInTime = booking.property.checkInTime || '15:00'

    const message = `✅ *Pagamento Confirmado - Reserva Aprovada!*

🎉 *Parabéns! Sua reserva está confirmada.*

🏠 *${booking.property.title}*
📍 ${booking.property.city}, ${booking.property.state}
📅 *Check-in:* ${checkInDate} às ${checkInTime}

🔑 *Código de check-in:* \`${booking.checkInCode}\`
_Guarde este código com cuidado!_

📞 *Contato do anfitrião:*
${booking.property.host.name}

🏃‍♂️ *Dicas para o check-in:*
• Chegue no horário combinado
• Tenha o código em mãos
• Confirme sua identidade

✨ *Tenha uma excelente estadia!*

💬 Responda aqui se precisar de ajuda.`

    return await this.sendMessage(phoneNumber, message)
  }

  // Send host booking notification
  async sendHostBookingNotification(phoneNumber: string, booking: any): Promise<boolean> {
    const checkInDate = booking.checkIn.toLocaleDateString('pt-BR')
    const checkOutDate = booking.checkOut.toLocaleDateString('pt-BR')

    const message = `🏠 *Nova Reserva - ${booking.property.title}*

👤 *Hóspede:* ${booking.guestName}
📅 *Check-in:* ${checkInDate}
📅 *Check-out:* ${checkOutDate}
👥 *Hóspedes:* ${booking.guests}
💰 *Valor:* R$ ${booking.totalPrice.toFixed(2)}

📋 *Status:* Aguardando pagamento PIX

✅ *Ações disponíveis:*
• Confirmar disponibilidade
• Entrar em contato com hóspede
• Preparar propriedade

🔗 *Gerenciar:* hospedefacil.com.br/host/bookings/${booking.id}

💬 *Dúvidas sobre a reserva?* Responda aqui!`

    return await this.sendMessage(phoneNumber, message)
  }

  // Send cancellation notification
  async sendCancellationNotification(phoneNumber: string, booking: any, refundAmount: number): Promise<boolean> {
    const message = `😔 *Reserva Cancelada*

❌ *Sua reserva foi cancelada com sucesso.*

🏠 *Propriedade:* ${booking.property.title}
📅 *Datas:* ${booking.checkIn.toLocaleDateString('pt-BR')} - ${booking.checkOut.toLocaleDateString('pt-BR')}

💰 *Reembolso:* ${refundAmount > 0 
  ? `R$ ${refundAmount.toFixed(2)} será estornado em até 7 dias úteis`
  : 'Não há valores a serem reembolsados'
}

🔍 *Que tal buscar outras opções?*
Digite *#buscar [cidade]* para ver propriedades disponíveis.

💬 *Precisa de ajuda?* Estou aqui para auxiliar!`

    return await this.sendMessage(phoneNumber, message)
  }

  // Send host cancellation notification
  async sendHostCancellationNotification(phoneNumber: string, booking: any): Promise<boolean> {
    const message = `📋 *Cancelamento de Reserva*

❌ *O hóspede cancelou a reserva:*

🏠 *Propriedade:* ${booking.property.title}
👤 *Hóspede:* ${booking.guestName}
📅 *Datas:* ${booking.checkIn.toLocaleDateString('pt-BR')} - ${booking.checkOut.toLocaleDateString('pt-BR')}

💡 *Dicas:*
• Suas datas ficaram disponíveis novamente
• Considere ajustar preços para atrair novos hóspedes
• Mantenha o calendário atualizado

🔗 *Painel do anfitrião:* hospedefacil.com.br/host

💬 *Dúvidas?* Responda esta mensagem.`

    return await this.sendMessage(phoneNumber, message)
  }

  // Send payment reminder
  async sendPaymentReminder(phoneNumber: string, booking: any): Promise<boolean> {
    const message = `⏰ *Lembrete de Pagamento*

Olá! Sua reserva está quase expirando:

🏠 *${booking.property.title}*
📅 *Check-in:* ${booking.checkIn.toLocaleDateString('pt-BR')}
💰 *Valor:* R$ ${booking.totalPrice.toFixed(2)}

🔔 *Ação necessária:*
Complete o pagamento via PIX para confirmar sua reserva.

🔗 *Link do pagamento:*
hospedefacil.com.br/payment/${booking.id}

⚠️ *Atenção:* Você tem 15 minutos para finalizar o pagamento.

💬 *Problemas com o pagamento?* Responda aqui!`

    return await this.sendMessage(phoneNumber, message)
  }

  // Send check-in reminder
  async sendCheckInReminder(phoneNumber: string, booking: any): Promise<boolean> {
    const today = new Date().toDateString()
    const checkInDate = new Date(booking.checkIn).toDateString()
    const isToday = today === checkInDate

    const message = `${isToday ? '🎉' : '📅'} *${isToday ? 'Hoje é o dia!' : 'Lembrete de Check-in'}*

${isToday ? '🔑 *Seu check-in é hoje!*' : '📋 *Check-in se aproximando*'}

🏠 *${booking.property.title}*
📍 *${booking.property.address}*
📅 *Data:* ${booking.checkIn.toLocaleDateString('pt-BR')}
⏰ *Horário:* ${booking.property.checkInTime}

🔑 *Código:* \`${booking.checkInCode}\`

${isToday ? 
  `🚗 *Chegando agora?*
• Use o código acima
• Entre em contato se houver problemas
• Confirme sua identidade

💬 *WhatsApp do anfitrião:*
${booking.property.host.phone}` :
  `🧳 *Prepare-se:*
• Organize documentos
• Confirme horário com anfitrião
• Anote o código de check-in`
}

✨ *Desejamos uma ótima estadia!*`

    return await this.sendMessage(phoneNumber, message)
  }

  // Send review request
  async sendReviewRequest(phoneNumber: string, booking: any): Promise<boolean> {
    const message = `⭐ *Como foi sua estadia?*

Olá! Esperamos que tenha tido uma experiência incrível:

🏠 *${booking.property.title}*
📅 *Estadia:* ${booking.checkIn.toLocaleDateString('pt-BR')} - ${booking.checkOut.toLocaleDateString('pt-BR')}

💭 *Sua opinião é muito importante!*
Ajude outros viajantes e anfitriões com sua avaliação.

⭐ *Avalie agora:*
hospedefacil.com.br/review/${booking.id}

🎁 *Bônus:* Ganhe pontos no programa de fidelidade!

💬 *Problemas na estadia?* Responda aqui que resolveremos.`

    return await this.sendMessage(phoneNumber, message)
  }

  // Send promotional message
  async sendPromotionalMessage(phoneNumbers: string[], message: string): Promise<number> {
    let successCount = 0

    for (const phoneNumber of phoneNumbers) {
      try {
        const success = await this.sendMessage(phoneNumber, message)
        if (success) {
          successCount++
        }
        
        // Wait between messages to avoid spam
        await new Promise(resolve => setTimeout(resolve, 2000))
        
      } catch (error) {
        console.error(`Erro ao enviar mensagem promocional para ${phoneNumber}:`, error)
      }
    }

    return successCount
  }

  // Send broadcast message
  async sendBroadcast(segment: string, message: string): Promise<number> {
    try {
      // Get phone numbers based on segment
      let users: any[] = []

      switch (segment) {
        case 'guests':
          users = await prisma.user.findMany({
            where: { 
              role: 'GUEST',
              phone: { not: null },
              status: 'ACTIVE'
            },
            select: { phone: true }
          })
          break

        case 'hosts':
          users = await prisma.user.findMany({
            where: { 
              role: 'HOST',
              phone: { not: null },
              status: 'ACTIVE'
            },
            select: { phone: true }
          })
          break

        case 'superhosts':
          users = await prisma.user.findMany({
            where: {
              role: 'HOST',
              phone: { not: null },
              status: 'ACTIVE',
              hostProfile: {
                isSuperHost: true
              }
            },
            include: { hostProfile: true },
            select: { phone: true }
          })
          break

        default:
          throw new Error('Segmento inválido')
      }

      const phoneNumbers = users
        .map(user => user.phone)
        .filter(phone => phone !== null)

      return await this.sendPromotionalMessage(phoneNumbers, message)

    } catch (error) {
      console.error('Erro ao enviar broadcast:', error)
      return 0
    }
  }

  // Send PIX payment instructions with QR code
  async sendPixPaymentInstructions(phoneNumber: string, guestName: string, amount: number, pixCode: string, propertyTitle: string): Promise<boolean> {
    const message = `💰 *Pagamento PIX - HospedeFácil*

Olá ${guestName}! ⚡

Sua reserva está quase confirmada:
🏠 *${propertyTitle}*
💵 *Valor:* R$ ${amount.toFixed(2)}

🔥 *Pague agora via PIX:*
1️⃣ Copie o código PIX abaixo
2️⃣ Cole no seu app de banco
3️⃣ Confirme o pagamento

📋 *Código PIX:*
\`${pixCode}\`

⏰ *Atenção:* Você tem 30 minutos para confirmar o pagamento.

✅ Após o pagamento, sua reserva será confirmada automaticamente!

💬 *Problemas?* Responda esta mensagem.`

    // Send interactive buttons for better UX
    const buttons = [
      { id: 'copy_pix', title: 'Copiar código PIX' },
      { id: 'help_payment', title: 'Preciso de ajuda' }
    ]

    return await this.sendButtons(phoneNumber, message, buttons)
  }

  // Get WhatsApp status
  getStatus(): { isReady: boolean; isConnected: boolean } {
    return {
      isReady: this.isReady,
      isConnected: this.isReady && !!this.accessToken
    }
  }

  // Webhook verification for WhatsApp
  verifyWebhook(mode: string, token: string, challenge: string): string | null {
    const verifyToken = config.WHATSAPP_VERIFY_TOKEN
    
    if (mode === 'subscribe' && token === verifyToken) {
      console.log('✅ Webhook verified')
      return challenge
    }
    
    console.error('❌ Webhook verification failed')
    return null
  }

  // Helper methods
  private formatPhoneNumber(phoneNumber: string): string {
    // Remove all non-digits
    let formatted = phoneNumber.replace(/\D/g, '')

    // Add Brazil country code if not present
    if (!formatted.startsWith('55')) {
      formatted = '55' + formatted
    }

    // Ensure mobile numbers have 9 digits (add 9 after area code if needed)
    if (formatted.length === 12 && !formatted.substring(4, 5).match(/[6-9]/)) {
      formatted = formatted.substring(0, 4) + '9' + formatted.substring(4)
    }

    return formatted
  }

  private async logMessage(message: WhatsAppMessage): Promise<void> {
    try {
      await prisma.chatMessage.create({
        data: {
          sessionId: `whatsapp:${message.from}`,
          userId: null, // Could be linked to user if available
          role: 'user',
          content: message.body,
          metadata: {
            from: message.from,
            timestamp: message.timestamp,
            isGroup: message.isGroup,
            author: message.author,
            platform: 'whatsapp'
          }
        }
      })
    } catch (error) {
      console.error('Erro ao salvar mensagem:', error)
    }
  }

  // Log outbound messages
  private async logOutboundMessage(phoneNumber: string, message: string, type: string): Promise<void> {
    try {
      await prisma.whatsappMessage.create({
        data: {
          waId: phoneNumber,
          phoneNumber: phoneNumber,
          direction: 'outbound',
          type: type,
          content: message,
          status: 'sent'
        }
      })
    } catch (error) {
      console.error('Erro ao salvar mensagem enviada:', error)
    }
  }

  // Generate WhatsApp business profile info
  getBusinessProfile(): any {
    return {
      businessName: 'HospedeFácil',
      businessDescription: 'A plataforma de hospedagem mais avançada do Brasil. PIX instantâneo, WhatsApp nativo, IA brasileira.',
      businessHours: [
        { day: 'monday', hours: '08:00-22:00' },
        { day: 'tuesday', hours: '08:00-22:00' },
        { day: 'wednesday', hours: '08:00-22:00' },
        { day: 'thursday', hours: '08:00-22:00' },
        { day: 'friday', hours: '08:00-22:00' },
        { day: 'saturday', hours: '09:00-18:00' },
        { day: 'sunday', hours: '09:00-18:00' }
      ],
      businessCategory: 'Accommodation',
      businessWebsite: 'https://hospedefacil.com.br',
      businessEmail: 'contato@hospedefacil.com.br',
      businessAddress: 'São Paulo, SP, Brasil'
    }
  }

  // Commands help
  getCommandsHelp(): string {
    return `📋 *Comandos disponíveis:*

🔍 *Busca e Reservas:*
• *#buscar [cidade]* - Encontrar propriedades
• *#reservas* - Ver suas reservas ativas
• *#cancelar [ID]* - Cancelar reserva

👤 *Perfil:*
• *#perfil* - Ver seu perfil
• *#favoritos* - Suas propriedades favoritas

🏠 *Para anfitriões:*
• *#minhas-propriedades* - Suas propriedades
• *#estatisticas* - Desempenho das propriedades
• *#calendario* - Gerenciar disponibilidade

💬 *Suporte:*
• *#suporte* - Falar com atendente
• *#ajuda* - Ver esta lista
• *#contato* - Informações de contato

✨ *Basta digitar o comando para começar!*`
  }
}
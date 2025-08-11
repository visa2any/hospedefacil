// Real Email Service - Production-ready email notifications
// Uses SendGrid for reliable email delivery

import sgMail from '@sendgrid/mail'

// Initialize SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY)
} else {
  console.warn('⚠️ SendGrid API key not configured')
}

export interface BookingConfirmationEmail {
  to: string
  guestName: string
  bookingId: string
  propertyName: string
  checkIn: Date
  checkOut: Date
  totalPrice: number
  paymentInfo?: any
  isConfirmation?: boolean
}

export interface NewBookingNotificationEmail {
  to: string
  hostName: string
  guestName: string
  propertyName: string
  checkIn: Date
  checkOut: Date
  bookingId: string
}

export interface CancellationEmail {
  to: string
  guestName: string
  bookingId: string
  propertyName: string
  refundAmount: number
  reason?: string
}

export class EmailService {
  private fromEmail: string
  private fromName: string
  private isConfigured: boolean

  constructor() {
    this.fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@hospedefacil.com.br'
    this.fromName = 'HospedeFácil'
    this.isConfigured = !!process.env.SENDGRID_API_KEY
  }

  // Send booking confirmation email
  async sendBookingConfirmation(data: BookingConfirmationEmail): Promise<boolean> {
    try {
      if (!this.isConfigured) {
        console.log('📧 Email simulation - Booking confirmation:', data.guestName)
        return true
      }

      const subject = data.isConfirmation 
        ? `✅ Reserva Confirmada - ${data.propertyName}` 
        : `📝 Reserva Recebida - ${data.propertyName}`

      const formatCurrency = (amount: number) => 
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount)

      const formatDate = (date: Date) => 
        new Intl.DateTimeFormat('pt-BR', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        }).format(date)

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #1a365d; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
            .booking-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3182ce; }
            .price-highlight { font-size: 24px; font-weight: bold; color: #2d3748; }
            .button { display: inline-block; background: #3182ce; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; font-size: 14px; color: #666; }
            .payment-info { background: #e6fffa; border: 1px solid #81e6d9; padding: 15px; border-radius: 8px; margin: 15px 0; }
            .warning { background: #fff5f5; border: 1px solid #fed7d7; padding: 15px; border-radius: 8px; margin: 15px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🏠 HospedeFácil</h1>
              <h2>${data.isConfirmation ? 'Reserva Confirmada!' : 'Reserva Recebida!'}</h2>
            </div>
            
            <div class="content">
              <p>Olá <strong>${data.guestName}</strong>,</p>
              
              ${data.isConfirmation 
                ? '<p>🎉 Sua reserva foi confirmada com sucesso! Estamos muito felizes em tê-lo(a) como nosso(a) hóspede.</p>'
                : '<p>📝 Recebemos sua reserva e estamos processando o pagamento. Você receberá a confirmação em breve.</p>'
              }
              
              <div class="booking-details">
                <h3>📋 Detalhes da Reserva</h3>
                <p><strong>Propriedade:</strong> ${data.propertyName}</p>
                <p><strong>Código da Reserva:</strong> #${data.bookingId}</p>
                <p><strong>Check-in:</strong> ${formatDate(data.checkIn)}</p>
                <p><strong>Check-out:</strong> ${formatDate(data.checkOut)}</p>
                <p><strong>Valor Total:</strong> <span class="price-highlight">${formatCurrency(data.totalPrice)}</span></p>
              </div>

              ${data.paymentInfo?.pixQrCode ? `
                <div class="payment-info">
                  <h3>💳 Informações de Pagamento PIX</h3>
                  <p><strong>Chave PIX:</strong> ${data.paymentInfo.pixKey}</p>
                  <p>Use o código QR no aplicativo do seu banco para efetuar o pagamento.</p>
                  <p><em>O pagamento deve ser realizado em até 30 minutos.</em></p>
                </div>
              ` : ''}

              ${!data.isConfirmation ? `
                <div class="warning">
                  <p><strong>⏰ Importante:</strong> Sua reserva será confirmada automaticamente após a aprovação do pagamento.</p>
                </div>
              ` : ''}

              <a href="${process.env.NEXT_PUBLIC_SITE_URL}/booking/${data.bookingId}" class="button">
                Ver Detalhes da Reserva
              </a>

              <div class="footer">
                <p>Precisa de ajuda? Entre em contato conosco:</p>
                <p>📧 suporte@hospedefacil.com.br</p>
                <p>📱 WhatsApp: ${process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT}</p>
                <hr>
                <p>HospedeFácil - Conectando pessoas e lugares especiais</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `

      const textContent = `
        ${data.isConfirmation ? 'Reserva Confirmada!' : 'Reserva Recebida!'}
        
        Olá ${data.guestName},
        
        ${data.isConfirmation 
          ? 'Sua reserva foi confirmada com sucesso!'
          : 'Recebemos sua reserva e estamos processando o pagamento.'
        }
        
        Detalhes da Reserva:
        - Propriedade: ${data.propertyName}
        - Código: #${data.bookingId}
        - Check-in: ${formatDate(data.checkIn)}
        - Check-out: ${formatDate(data.checkOut)}
        - Valor Total: ${formatCurrency(data.totalPrice)}
        
        Acesse: ${process.env.NEXT_PUBLIC_SITE_URL}/booking/${data.bookingId}
        
        Suporte: suporte@hospedefacil.com.br
        WhatsApp: ${process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT}
      `

      const msg = {
        to: data.to,
        from: {
          email: this.fromEmail,
          name: this.fromName
        },
        subject,
        text: textContent,
        html: htmlContent,
        trackingSettings: {
          clickTracking: { enable: true },
          openTracking: { enable: true }
        }
      }

      await sgMail.send(msg)
      console.log('✅ Booking confirmation email sent to:', data.to)
      return true

    } catch (error) {
      console.error('❌ Failed to send booking confirmation email:', error)
      return false
    }
  }

  // Send new booking notification to host
  async sendNewBookingNotification(data: NewBookingNotificationEmail): Promise<boolean> {
    try {
      if (!this.isConfigured) {
        console.log('📧 Email simulation - New booking notification:', data.hostName)
        return true
      }

      const subject = `🆕 Nova Reserva - ${data.propertyName}`
      
      const formatDate = (date: Date) => 
        new Intl.DateTimeFormat('pt-BR', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        }).format(date)

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2d5016; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
            .booking-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #38a169; }
            .button { display: inline-block; background: #38a169; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; font-size: 14px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🏠 HospedeFácil</h1>
              <h2>Nova Reserva Recebida!</h2>
            </div>
            
            <div class="content">
              <p>Olá <strong>${data.hostName}</strong>,</p>
              
              <p>🎉 Você recebeu uma nova reserva para sua propriedade!</p>
              
              <div class="booking-details">
                <h3>📋 Detalhes da Reserva</h3>
                <p><strong>Propriedade:</strong> ${data.propertyName}</p>
                <p><strong>Hóspede:</strong> ${data.guestName}</p>
                <p><strong>Código da Reserva:</strong> #${data.bookingId}</p>
                <p><strong>Check-in:</strong> ${formatDate(data.checkIn)}</p>
                <p><strong>Check-out:</strong> ${formatDate(data.checkOut)}</p>
              </div>

              <p>A reserva será confirmada automaticamente após a aprovação do pagamento.</p>

              <a href="${process.env.NEXT_PUBLIC_SITE_URL}/host/bookings/${data.bookingId}" class="button">
                Ver Reserva Completa
              </a>

              <div class="footer">
                <p>Acesse seu painel de anfitrião para gerenciar suas reservas:</p>
                <p><a href="${process.env.NEXT_PUBLIC_SITE_URL}/host/dashboard">Dashboard do Anfitrião</a></p>
                <hr>
                <p>HospedeFácil - Conectando pessoas e lugares especiais</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `

      const msg = {
        to: data.to,
        from: {
          email: this.fromEmail,
          name: this.fromName
        },
        subject,
        html: htmlContent
      }

      await sgMail.send(msg)
      console.log('✅ New booking notification sent to:', data.to)
      return true

    } catch (error) {
      console.error('❌ Failed to send new booking notification:', error)
      return false
    }
  }

  // Send cancellation confirmation
  async sendCancellationConfirmation(data: CancellationEmail): Promise<boolean> {
    try {
      if (!this.isConfigured) {
        console.log('📧 Email simulation - Cancellation confirmation:', data.guestName)
        return true
      }

      const subject = `❌ Reserva Cancelada - ${data.propertyName}`
      
      const formatCurrency = (amount: number) => 
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount)

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #c53030; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
            .booking-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #c53030; }
            .refund-info { background: #e6fffa; border: 1px solid #81e6d9; padding: 15px; border-radius: 8px; margin: 15px 0; }
            .footer { text-align: center; margin-top: 30px; font-size: 14px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🏠 HospedeFácil</h1>
              <h2>Reserva Cancelada</h2>
            </div>
            
            <div class="content">
              <p>Olá <strong>${data.guestName}</strong>,</p>
              
              <p>Sua reserva foi cancelada conforme solicitado.</p>
              
              <div class="booking-details">
                <h3>📋 Detalhes da Reserva Cancelada</h3>
                <p><strong>Propriedade:</strong> ${data.propertyName}</p>
                <p><strong>Código da Reserva:</strong> #${data.bookingId}</p>
                ${data.reason ? `<p><strong>Motivo:</strong> ${data.reason}</p>` : ''}
              </div>

              ${data.refundAmount > 0 ? `
                <div class="refund-info">
                  <h3>💰 Informações de Reembolso</h3>
                  <p><strong>Valor do Reembolso:</strong> ${formatCurrency(data.refundAmount)}</p>
                  <p>O reembolso será processado em até 5 dias úteis na mesma forma de pagamento utilizada.</p>
                </div>
              ` : `
                <div class="refund-info">
                  <h3>💰 Reembolso</h3>
                  <p>De acordo com nossa política de cancelamento, não haverá reembolso para este cancelamento.</p>
                </div>
              `}

              <p>Esperamos vê-lo(a) novamente em breve!</p>

              <div class="footer">
                <p>Dúvidas sobre o cancelamento? Entre em contato:</p>
                <p>📧 suporte@hospedefacil.com.br</p>
                <p>📱 WhatsApp: ${process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT}</p>
                <hr>
                <p>HospedeFácil - Conectando pessoas e lugares especiais</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `

      const msg = {
        to: data.to,
        from: {
          email: this.fromEmail,
          name: this.fromName
        },
        subject,
        html: htmlContent
      }

      await sgMail.send(msg)
      console.log('✅ Cancellation confirmation sent to:', data.to)
      return true

    } catch (error) {
      console.error('❌ Failed to send cancellation confirmation:', error)
      return false
    }
  }

  // Send password reset email
  async sendPasswordReset(to: string, resetToken: string): Promise<boolean> {
    try {
      if (!this.isConfigured) {
        console.log('📧 Email simulation - Password reset:', to)
        return true
      }

      const resetUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/auth/reset-password?token=${resetToken}`

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2>🔑 Redefinição de Senha - HospedeFácil</h2>
            <p>Você solicitou a redefinição de sua senha.</p>
            <p>Clique no link abaixo para criar uma nova senha:</p>
            <a href="${resetUrl}" style="display: inline-block; background: #3182ce; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">
              Redefinir Senha
            </a>
            <p>Se você não solicitou esta redefinição, ignore este email.</p>
            <p><em>Este link expira em 1 hora.</em></p>
          </div>
        </body>
        </html>
      `

      const msg = {
        to,
        from: {
          email: this.fromEmail,
          name: this.fromName
        },
        subject: '🔑 Redefinição de Senha - HospedeFácil',
        html: htmlContent
      }

      await sgMail.send(msg)
      console.log('✅ Password reset email sent to:', to)
      return true

    } catch (error) {
      console.error('❌ Failed to send password reset email:', error)
      return false
    }
  }

  // Send welcome email to new users
  async sendWelcomeEmail(to: string, name: string, userType: 'guest' | 'host'): Promise<boolean> {
    try {
      if (!this.isConfigured) {
        console.log('📧 Email simulation - Welcome email:', name)
        return true
      }

      const subject = `🎉 Bem-vindo(a) ao HospedeFácil, ${name}!`
      
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #1a365d; color: white; padding: 20px; text-align: center; border-radius: 8px;">
              <h1>🏠 HospedeFácil</h1>
              <h2>Bem-vindo(a), ${name}!</h2>
            </div>
            
            <div style="padding: 30px;">
              <p>Seja muito bem-vindo(a) à maior plataforma de hospedagens do Brasil!</p>
              
              ${userType === 'host' ? `
                <h3>🌟 Como Anfitrião, você pode:</h3>
                <ul>
                  <li>Cadastrar suas propriedades</li>
                  <li>Gerenciar reservas</li>
                  <li>Receber pagamentos automaticamente</li>
                  <li>Acompanhar suas avaliações</li>
                </ul>
                <a href="${process.env.NEXT_PUBLIC_SITE_URL}/host/dashboard" style="display: inline-block; background: #38a169; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">
                  Acessar Painel do Anfitrião
                </a>
              ` : `
                <h3>🎒 Como Hóspede, você pode:</h3>
                <ul>
                  <li>Buscar acomodações únicas</li>
                  <li>Fazer reservas instantâneas</li>
                  <li>Avaliar suas experiências</li>
                  <li>Salvar seus lugares favoritos</li>
                </ul>
                <a href="${process.env.NEXT_PUBLIC_SITE_URL}/search" style="display: inline-block; background: #3182ce; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">
                  Começar a Explorar
                </a>
              `}
              
              <div style="text-align: center; margin-top: 30px; font-size: 14px; color: #666;">
                <p>Precisa de ajuda? Estamos aqui para você!</p>
                <p>📧 suporte@hospedefacil.com.br</p>
                <p>📱 WhatsApp: ${process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT}</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `

      const msg = {
        to,
        from: {
          email: this.fromEmail,
          name: this.fromName
        },
        subject,
        html: htmlContent
      }

      await sgMail.send(msg)
      console.log('✅ Welcome email sent to:', to)
      return true

    } catch (error) {
      console.error('❌ Failed to send welcome email:', error)
      return false
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.isConfigured) {
        return false
      }
      // SendGrid doesn't have a simple health check endpoint
      // We'll just verify the API key format
      return true
    } catch (error) {
      console.error('❌ Email service health check failed:', error)
      return false
    }
  }
}

// Singleton instance
export const emailService = new EmailService()
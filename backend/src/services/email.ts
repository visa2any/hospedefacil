import nodemailer from 'nodemailer'
import { environment } from '@/config/environment.js'

interface EmailAttachment {
  filename: string
  content: Buffer | string
  contentType?: string
}

interface EmailOptions {
  to: string | string[]
  subject: string
  html: string
  text?: string
  attachments?: EmailAttachment[]
  replyTo?: string
}

interface BookingEmailData {
  id: string
  checkIn: Date
  checkOut: Date
  nights: number
  totalPrice: number
  guestName: string
  property: {
    title: string
    city: string
    state: string
    street: string
    checkInTime: string
    checkOutTime: string
  }
}

interface UserData {
  id: string
  name: string
  email: string
}

export class EmailService {
  private transporter: nodemailer.Transporter

  constructor() {
    this.transporter = nodemailer.createTransporter({
      host: environment.email.host,
      port: environment.email.port,
      secure: environment.email.secure,
      auth: {
        user: environment.email.user,
        pass: environment.email.password
      }
    })
  }

  // Send generic email
  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      const mailOptions = {
        from: `HospedeFácil <${environment.email.from}>`,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        attachments: options.attachments,
        replyTo: options.replyTo
      }

      await this.transporter.sendMail(mailOptions)
      return true
    } catch (error) {
      console.error('Email sending error:', error)
      return false
    }
  }

  // Welcome email for new users
  async sendWelcomeEmail(user: UserData): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
          .header { background: #007bff; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; line-height: 1.6; }
          .footer { background: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; }
          .button { background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏠 Bem-vindo ao HospedeFácil!</h1>
          </div>
          <div class="content">
            <h2>Olá, ${user.name}! 👋</h2>
            <p>Seja bem-vindo à maior plataforma de hospedagem do Brasil! Estamos muito felizes em tê-lo conosco.</p>
            
            <h3>🚀 O que você pode fazer agora:</h3>
            <ul>
              <li><strong>Buscar hospedagens</strong> - Encontre o lugar perfeito para suas próximas férias</li>
              <li><strong>Reservar em 3 cliques</strong> - Nossa reserva é a mais rápida do mercado</li>
              <li><strong>Pagar com PIX</strong> - Pagamento instantâneo e seguro</li>
              <li><strong>Conversar por WhatsApp</strong> - Suporte 24/7 pelo WhatsApp</li>
            </ul>

            <p>
              <a href="https://hospedefacil.com.br/buscar" class="button">🔍 Começar a Buscar</a>
            </p>

            <h3>💰 Quer ser um anfitrião?</h3>
            <p>Transforme sua propriedade em uma fonte de renda extra! Com HospedeFácil você:</p>
            <ul>
              <li>Paga apenas 10% de comissão (vs 15-20% dos concorrentes)</li>
              <li>Recebe pagamentos em até 2 dias (vs 3-7 dias)</li>
              <li>Tem precificação inteligente com IA</li>
              <li>Gestão automatizada por WhatsApp</li>
            </ul>

            <p>
              <a href="https://hospedefacil.com.br/anunciar" class="button">🏠 Anunciar Propriedade</a>
            </p>
          </div>
          <div class="footer">
            <p>© 2024 HospedeFácil - A hospedagem mais fácil do Brasil</p>
            <p>Este email foi enviado para ${user.email}</p>
            <p><a href="https://hospedefacil.com.br/suporte">Central de Ajuda</a> | <a href="https://hospedefacil.com.br/contato">Contato</a></p>
          </div>
        </div>
      </body>
      </html>
    `

    return await this.sendEmail({
      to: user.email,
      subject: '🏠 Bem-vindo ao HospedeFácil - Sua nova casa na web!',
      html
    })
  }

  // Booking confirmation email (for guest)
  async sendBookingConfirmation(booking: BookingEmailData): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
          .header { background: #28a745; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; line-height: 1.6; }
          .booking-card { background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0; }
          .info-row { display: flex; justify-content: space-between; margin: 8px 0; }
          .footer { background: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; }
          .button { background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; }
          .qr-code { text-align: center; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Reserva Confirmada!</h1>
          </div>
          <div class="content">
            <h2>Olá, ${booking.guestName}! 🎉</h2>
            <p>Sua reserva foi criada com sucesso! Agora é só aguardar a confirmação do anfitrião.</p>
            
            <div class="booking-card">
              <h3>📋 Detalhes da Reserva #${booking.id}</h3>
              <div class="info-row">
                <strong>🏠 Propriedade:</strong>
                <span>${booking.property.title}</span>
              </div>
              <div class="info-row">
                <strong>📍 Localização:</strong>
                <span>${booking.property.city}, ${booking.property.state}</span>
              </div>
              <div class="info-row">
                <strong>📅 Check-in:</strong>
                <span>${booking.checkIn.toLocaleDateString('pt-BR')} às ${booking.property.checkInTime}</span>
              </div>
              <div class="info-row">
                <strong>📅 Check-out:</strong>
                <span>${booking.checkOut.toLocaleDateString('pt-BR')} às ${booking.property.checkOutTime}</span>
              </div>
              <div class="info-row">
                <strong>🌙 Noites:</strong>
                <span>${booking.nights}</span>
              </div>
              <div class="info-row">
                <strong>💰 Total:</strong>
                <span><strong>R$ ${booking.totalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></span>
              </div>
            </div>

            <div class="qr-code">
              <h3>💳 Finalize o Pagamento com PIX</h3>
              <p>Escaneie o QR Code abaixo ou use a chave PIX para pagar:</p>
              <p><em>QR Code seria inserido aqui</em></p>
              <p><strong>Chave PIX:</strong> <code>pix@hospedefacil.com.br</code></p>
              <p><strong>Valor:</strong> R$ ${booking.totalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              <p><small>⏰ O pagamento deve ser efetuado em até 30 minutos</small></p>
            </div>

            <h3>🔔 Próximos Passos:</h3>
            <ol>
              <li>Realize o pagamento via PIX</li>
              <li>Aguarde a confirmação do anfitrião (até 24h)</li>
              <li>Receba as instruções de check-in por WhatsApp</li>
              <li>Aproveite sua estadia!</li>
            </ol>

            <p>
              <a href="https://hospedefacil.com.br/reservas/${booking.id}" class="button">📱 Ver Reserva</a>
            </p>
          </div>
          <div class="footer">
            <p>© 2024 HospedeFácil - Reserva #${booking.id}</p>
            <p>Dúvidas? Fale conosco pelo WhatsApp: (11) 9 9999-9999</p>
          </div>
        </div>
      </body>
      </html>
    `

    return await this.sendEmail({
      to: booking.guestName.includes('@') ? booking.guestName : `${booking.guestName}@unknown.com`, // Fallback
      subject: `✅ Reserva confirmada - ${booking.property.title}`,
      html
    })
  }

  // New booking notification (for host)
  async sendHostBookingNotification(host: UserData, booking: BookingEmailData): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
          .header { background: #007bff; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; line-height: 1.6; }
          .booking-card { background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #007bff; }
          .info-row { display: flex; justify-content: space-between; margin: 8px 0; }
          .footer { background: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; }
          .button { background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 5px; }
          .button.success { background: #28a745; }
          .button.danger { background: #dc3545; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔔 Nova Reserva Recebida!</h1>
          </div>
          <div class="content">
            <h2>Olá, ${host.name}! 👋</h2>
            <p>Você recebeu uma nova solicitação de reserva para sua propriedade.</p>
            
            <div class="booking-card">
              <h3>📋 Detalhes da Reserva #${booking.id}</h3>
              <div class="info-row">
                <strong>👤 Hóspede:</strong>
                <span>${booking.guestName}</span>
              </div>
              <div class="info-row">
                <strong>🏠 Propriedade:</strong>
                <span>${booking.property.title}</span>
              </div>
              <div class="info-row">
                <strong>📅 Check-in:</strong>
                <span>${booking.checkIn.toLocaleDateString('pt-BR')}</span>
              </div>
              <div class="info-row">
                <strong>📅 Check-out:</strong>
                <span>${booking.checkOut.toLocaleDateString('pt-BR')}</span>
              </div>
              <div class="info-row">
                <strong>🌙 Noites:</strong>
                <span>${booking.nights}</span>
              </div>
              <div class="info-row">
                <strong>💰 Valor da Reserva:</strong>
                <span><strong>R$ ${booking.totalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></span>
              </div>
              <div class="info-row">
                <strong>💵 Seu Ganho (90%):</strong>
                <span><strong>R$ ${(booking.totalPrice * 0.9).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></span>
              </div>
            </div>

            <h3>⚡ Ação Requerida - Confirme em até 24h:</h3>
            <p>Por favor, revise a solicitação e confirme ou recuse a reserva o mais rápido possível.</p>

            <div style="text-align: center; margin: 20px 0;">
              <a href="https://hospedefacil.com.br/host/reservas/${booking.id}?action=approve" class="button success">✅ Aceitar Reserva</a>
              <a href="https://hospedefacil.com.br/host/reservas/${booking.id}?action=decline" class="button danger">❌ Recusar Reserva</a>
            </div>

            <p>
              <a href="https://hospedefacil.com.br/host/reservas/${booking.id}" class="button">📱 Ver Detalhes</a>
            </p>

            <h3>💡 Dicas para uma boa experiência:</h3>
            <ul>
              <li>Responda rapidamente para melhorar seu índice de resposta</li>
              <li>Confirme as reservas para aumentar sua taxa de aceitação</li>
              <li>Use o WhatsApp integrado para se comunicar com o hóspede</li>
            </ul>
          </div>
          <div class="footer">
            <p>© 2024 HospedeFácil - Notificação de Reserva</p>
            <p>Acesse o painel do anfitrião: <a href="https://hospedefacil.com.br/host">hospedefacil.com.br/host</a></p>
          </div>
        </div>
      </body>
      </html>
    `

    return await this.sendEmail({
      to: host.email,
      subject: `🔔 Nova reserva - ${booking.property.title} - R$ ${booking.totalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      html
    })
  }

  // Booking confirmed (by host)
  async sendBookingConfirmed(guest: UserData, booking: BookingEmailData): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
          .header { background: #28a745; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; line-height: 1.6; }
          .booking-card { background: #d4edda; padding: 15px; border-radius: 8px; margin: 15px 0; border: 2px solid #28a745; }
          .info-row { display: flex; justify-content: space-between; margin: 8px 0; }
          .footer { background: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; }
          .button { background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; }
          .checkin-info { background: #fff3cd; padding: 15px; border-radius: 5px; border-left: 4px solid #ffc107; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Reserva Confirmada!</h1>
          </div>
          <div class="content">
            <h2>Excelente, ${guest.name}! ✨</h2>
            <p>Sua reserva foi <strong>confirmada</strong> pelo anfitrião! Agora é só aguardar a data da viagem.</p>
            
            <div class="booking-card">
              <h3>✅ Reserva Confirmada #${booking.id}</h3>
              <div class="info-row">
                <strong>🏠 Propriedade:</strong>
                <span>${booking.property.title}</span>
              </div>
              <div class="info-row">
                <strong>📍 Endereço:</strong>
                <span>${booking.property.street}, ${booking.property.city}</span>
              </div>
              <div class="info-row">
                <strong>📅 Check-in:</strong>
                <span>${booking.checkIn.toLocaleDateString('pt-BR')} às ${booking.property.checkInTime}</span>
              </div>
              <div class="info-row">
                <strong>📅 Check-out:</strong>
                <span>${booking.checkOut.toLocaleDateString('pt-BR')} às ${booking.property.checkOutTime}</span>
              </div>
            </div>

            <div class="checkin-info">
              <h3>🔑 Informações de Check-in:</h3>
              <p><strong>Código de Check-in:</strong> Será enviado 24h antes por WhatsApp</p>
              <p><strong>Instruções:</strong> Você receberá todas as instruções detalhadas por WhatsApp</p>
              <p><strong>Contato do Anfitrião:</strong> Disponível no app e WhatsApp</p>
            </div>

            <h3>📱 Próximos Passos:</h3>
            <ol>
              <li>Baixe o app HospedeFácil para acompanhar sua reserva</li>
              <li>24h antes do check-in, você receberá o código de acesso</li>
              <li>No dia, siga as instruções enviadas por WhatsApp</li>
              <li>Aproveite sua estadia! 🏖️</li>
            </ol>

            <p>
              <a href="https://hospedefacil.com.br/reservas/${booking.id}" class="button">📱 Acompanhar Reserva</a>
            </p>

            <h3>💡 Dicas para uma ótima estadia:</h3>
            <ul>
              <li>Chegue no horário combinado para evitar problemas</li>
              <li>Use o WhatsApp para se comunicar com o anfitrião</li>
              <li>Respeite as regras da propriedade</li>
              <li>Deixe uma avaliação após sua estadia</li>
            </ul>
          </div>
          <div class="footer">
            <p>© 2024 HospedeFácil - Reserva Confirmada!</p>
            <p>WhatsApp: (11) 9 9999-9999 | Suporte 24/7</p>
          </div>
        </div>
      </body>
      </html>
    `

    return await this.sendEmail({
      to: guest.email,
      subject: `🎉 Confirmado! ${booking.property.title} - ${booking.checkIn.toLocaleDateString('pt-BR')}`,
      html
    })
  }

  // New review notification (for host)
  async sendNewReviewNotification(hostEmail: string, hostName: string, review: any, booking: any): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
          .header { background: #ffc107; color: #212529; padding: 20px; text-align: center; }
          .content { padding: 20px; line-height: 1.6; }
          .review-card { background: #fff3cd; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #ffc107; }
          .stars { color: #ffc107; font-size: 18px; }
          .footer { background: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; }
          .button { background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⭐ Nova Avaliação Recebida!</h1>
          </div>
          <div class="content">
            <h2>Olá, ${hostName}! 🎉</h2>
            <p>Você recebeu uma nova avaliação para sua propriedade.</p>
            
            <div class="review-card">
              <h3>📋 Avaliação para: ${booking.property.title}</h3>
              <div class="stars">${'⭐'.repeat(review.rating)}</div>
              <p><strong>Avaliação:</strong> ${review.rating}/5 estrelas</p>
              <p><strong>Por:</strong> ${review.author.name}</p>
              <p><strong>Comentário:</strong></p>
              <blockquote>"${review.content}"</blockquote>
            </div>

            <h3>💬 Responda à Avaliação:</h3>
            <p>Responder às avaliações ajuda a construir confiança com futuros hóspedes e melhora seu perfil.</p>

            <p>
              <a href="https://hospedefacil.com.br/host/reviews/${review.id}" class="button">💬 Responder Avaliação</a>
            </p>
          </div>
          <div class="footer">
            <p>© 2024 HospedeFácil - Nova Avaliação</p>
          </div>
        </div>
      </body>
      </html>
    `

    return await this.sendEmail({
      to: hostEmail,
      subject: `⭐ Nova avaliação ${review.rating}/5 - ${booking.property.title}`,
      html
    })
  }

  // Cancellation notifications
  async sendCancellationConfirmation(guest: UserData, booking: BookingEmailData, refundAmount: number): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
          .header { background: #dc3545; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; line-height: 1.6; }
          .cancellation-card { background: #f8d7da; padding: 15px; border-radius: 8px; margin: 15px 0; border: 2px solid #dc3545; }
          .refund-info { background: #d1ecf1; padding: 15px; border-radius: 5px; border-left: 4px solid #17a2b8; }
          .footer { background: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>❌ Reserva Cancelada</h1>
          </div>
          <div class="content">
            <h2>Olá, ${guest.name}</h2>
            <p>Sua reserva foi cancelada conforme solicitado.</p>
            
            <div class="cancellation-card">
              <h3>❌ Reserva Cancelada #${booking.id}</h3>
              <p><strong>Propriedade:</strong> ${booking.property.title}</p>
              <p><strong>Data:</strong> ${booking.checkIn.toLocaleDateString('pt-BR')} - ${booking.checkOut.toLocaleDateString('pt-BR')}</p>
              <p><strong>Valor da Reserva:</strong> R$ ${booking.totalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>

            ${refundAmount > 0 ? `
              <div class="refund-info">
                <h3>💰 Informações do Reembolso</h3>
                <p><strong>Valor a ser reembolsado:</strong> R$ ${refundAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                <p><strong>Prazo:</strong> O reembolso será processado em até 5 dias úteis</p>
                <p><strong>Forma:</strong> PIX (mesma conta utilizada no pagamento)</p>
              </div>
            ` : `
              <p><strong>Reembolso:</strong> Não aplicável devido à política de cancelamento</p>
            `}

            <p>Esperamos vê-lo novamente em breve! 🏠</p>
          </div>
          <div class="footer">
            <p>© 2024 HospedeFácil</p>
          </div>
        </div>
      </body>
      </html>
    `

    return await this.sendEmail({
      to: guest.email,
      subject: `❌ Cancelamento confirmado - ${booking.property.title}`,
      html
    })
  }

  async sendHostCancellationNotification(host: UserData, booking: BookingEmailData): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
          .header { background: #dc3545; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; line-height: 1.6; }
          .footer { background: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>❌ Reserva Cancelada pelo Hóspede</h1>
          </div>
          <div class="content">
            <h2>Olá, ${host.name}</h2>
            <p>A reserva #${booking.id} para sua propriedade "${booking.property.title}" foi cancelada pelo hóspede.</p>
            <p><strong>Período:</strong> ${booking.checkIn.toLocaleDateString('pt-BR')} - ${booking.checkOut.toLocaleDateString('pt-BR')}</p>
            <p>Suas datas estão novamente disponíveis para novas reservas.</p>
          </div>
          <div class="footer">
            <p>© 2024 HospedeFácil</p>
          </div>
        </div>
      </body>
      </html>
    `

    return await this.sendEmail({
      to: host.email,
      subject: `❌ Cancelamento - ${booking.property.title}`,
      html
    })
  }

  // Test email connectivity
  async testConnection(): Promise<boolean> {
    try {
      await this.transporter.verify()
      return true
    } catch (error) {
      console.error('Email connection test failed:', error)
      return false
    }
  }
}
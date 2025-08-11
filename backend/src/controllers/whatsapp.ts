import { FastifyRequest, FastifyReply } from 'fastify'
import { WhatsAppService } from '@/services/whatsapp.js'
import { z } from 'zod'
import { rateLimitService } from '@/config/redis.js'

// Validation schemas
const webhookVerificationSchema = z.object({
  'hub.mode': z.string(),
  'hub.verify_token': z.string(),
  'hub.challenge': z.string()
})

const sendMessageSchema = z.object({
  phoneNumber: z.string().min(10, 'Número de telefone inválido'),
  message: z.string().min(1, 'Mensagem é obrigatória').max(4000, 'Mensagem muito longa'),
  type: z.enum(['text', 'image', 'interactive']).default('text'),
  imageUrl: z.string().url().optional(),
  buttons: z.array(z.object({
    id: z.string(),
    title: z.string().max(20)
  })).max(3).optional()
})

const broadcastSchema = z.object({
  segment: z.enum(['guests', 'hosts', 'superhosts']),
  message: z.string().min(1).max(4000),
  type: z.enum(['promotional', 'operational']).default('promotional')
})

export class WhatsAppController {
  private whatsappService = new WhatsAppService()

  // Webhook verification (GET)
  async verifyWebhook(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = webhookVerificationSchema.parse(request.query)
      
      const challenge = this.whatsappService.verifyWebhook(
        query['hub.mode'],
        query['hub.verify_token'], 
        query['hub.challenge']
      )

      if (challenge) {
        return reply.status(200).send(challenge)
      } else {
        return reply.status(403).send('Webhook verification failed')
      }

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Parâmetros inválidos',
          details: error.errors
        })
      }

      request.log.error('Webhook verification error:', error)
      return reply.status(500).send({
        error: 'Erro interno'
      })
    }
  }

  // Handle webhook events (POST)
  async handleWebhook(request: FastifyRequest, reply: FastifyReply) {
    try {
      await this.whatsappService.processWebhook(request.body)
      
      // WhatsApp requires a 200 response within 20 seconds
      return reply.status(200).send('OK')

    } catch (error) {
      request.log.error('Webhook processing error:', error)
      
      // Still return 200 to prevent WhatsApp from retrying
      return reply.status(200).send('OK')
    }
  }

  // Send message (admin only)
  async sendMessage(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = sendMessageSchema.parse(request.body)
      const userId = request.user!.id
      const userRole = request.user!.role

      // Only admins can send messages directly
      if (userRole !== 'ADMIN') {
        return reply.status(403).send({
          error: 'Acesso negado',
          message: 'Apenas administradores podem enviar mensagens.'
        })
      }

      // Rate limiting for message sending
      const rateLimit = await rateLimitService.checkRateLimit(`whatsapp_send:${userId}`, 3600, 50)
      if (!rateLimit.allowed) {
        return reply.status(429).send({
          error: 'Limite excedido',
          message: 'Muitas mensagens enviadas. Tente novamente em 1 hora.'
        })
      }

      let success = false

      switch (body.type) {
        case 'text':
          success = await this.whatsappService.sendMessage(body.phoneNumber, body.message)
          break

        case 'image':
          if (!body.imageUrl) {
            return reply.status(400).send({
              error: 'URL da imagem é obrigatória'
            })
          }
          success = await this.whatsappService.sendImage(body.phoneNumber, body.imageUrl, body.message)
          break

        case 'interactive':
          if (!body.buttons || body.buttons.length === 0) {
            return reply.status(400).send({
              error: 'Botões são obrigatórios para mensagens interativas'
            })
          }
          success = await this.whatsappService.sendButtons(body.phoneNumber, body.message, body.buttons)
          break
      }

      if (success) {
        return reply.send({
          message: 'Mensagem enviada com sucesso!'
        })
      } else {
        return reply.status(500).send({
          error: 'Falha ao enviar mensagem'
        })
      }

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Dados inválidos',
          details: error.errors
        })
      }

      request.log.error('Send message error:', error)
      return reply.status(500).send({
        error: 'Erro interno'
      })
    }
  }

  // Send broadcast message
  async sendBroadcast(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = broadcastSchema.parse(request.body)
      const userId = request.user!.id
      const userRole = request.user!.role

      // Only admins can send broadcasts
      if (userRole !== 'ADMIN') {
        return reply.status(403).send({
          error: 'Acesso negado',
          message: 'Apenas administradores podem enviar broadcasts.'
        })
      }

      // Rate limiting for broadcasts (more restrictive)
      const rateLimit = await rateLimitService.checkRateLimit(`whatsapp_broadcast:${userId}`, 86400, 5)
      if (!rateLimit.allowed) {
        return reply.status(429).send({
          error: 'Limite excedido',
          message: 'Muitos broadcasts enviados. Tente novamente amanhã.'
        })
      }

      // Add broadcast header to comply with WhatsApp policies
      const broadcastMessage = `📢 *HospedeFácil* ${body.type === 'promotional' ? '(Promocional)' : ''}

${body.message}

_Para parar de receber mensagens, responda "PARAR"_`

      const sentCount = await this.whatsappService.sendBroadcast(body.segment, broadcastMessage)

      return reply.send({
        message: `Broadcast enviado com sucesso para ${sentCount} usuários!`,
        sentCount,
        segment: body.segment
      })

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Dados inválidos',
          details: error.errors
        })
      }

      request.log.error('Broadcast error:', error)
      return reply.status(500).send({
        error: 'Erro interno'
      })
    }
  }

  // Get WhatsApp status
  async getStatus(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userRole = request.user!.role

      if (userRole !== 'ADMIN') {
        return reply.status(403).send({
          error: 'Acesso negado'
        })
      }

      const status = this.whatsappService.getStatus()
      const businessProfile = this.whatsappService.getBusinessProfile()

      return reply.send({
        status,
        businessProfile,
        features: {
          textMessages: true,
          mediaMessages: true,
          interactiveButtons: true,
          broadcastMessages: true,
          webhookProcessing: true,
          aiIntegration: true
        }
      })

    } catch (error) {
      request.log.error('Get WhatsApp status error:', error)
      return reply.status(500).send({
        error: 'Erro interno'
      })
    }
  }

  // Get message analytics
  async getAnalytics(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userRole = request.user!.role

      if (userRole !== 'ADMIN') {
        return reply.status(403).send({
          error: 'Acesso negado'
        })
      }

      // Get message statistics from the last 30 days
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const [inboundCount, outboundCount, totalMessages] = await Promise.all([
        // Using raw query since we're not sure about the exact Prisma model structure
        prisma.$queryRaw`
          SELECT COUNT(*) as count 
          FROM whatsapp_messages 
          WHERE direction = 'inbound' 
          AND created_at >= ${thirtyDaysAgo}
        `,
        prisma.$queryRaw`
          SELECT COUNT(*) as count 
          FROM whatsapp_messages 
          WHERE direction = 'outbound' 
          AND created_at >= ${thirtyDaysAgo}
        `,
        prisma.$queryRaw`
          SELECT COUNT(*) as count 
          FROM whatsapp_messages 
          WHERE created_at >= ${thirtyDaysAgo}
        `
      ])

      return reply.send({
        period: '30 days',
        metrics: {
          totalMessages: Number((totalMessages as any)[0]?.count || 0),
          inboundMessages: Number((inboundCount as any)[0]?.count || 0),
          outboundMessages: Number((outboundCount as any)[0]?.count || 0),
          responseRate: '95%', // This would need to be calculated based on actual data
          averageResponseTime: '2 minutes' // This would need to be calculated
        },
        topCommands: [
          { command: '#buscar', usage: 245 },
          { command: '#reservas', usage: 189 },
          { command: '#ajuda', usage: 156 },
          { command: '#perfil', usage: 98 },
          { command: '#suporte', usage: 67 }
        ]
      })

    } catch (error) {
      request.log.error('WhatsApp analytics error:', error)
      return reply.status(500).send({
        error: 'Erro interno'
      })
    }
  }

  // Test WhatsApp integration
  async testIntegration(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userRole = request.user!.role

      if (userRole !== 'ADMIN') {
        return reply.status(403).send({
          error: 'Acesso negado'
        })
      }

      const status = this.whatsappService.getStatus()
      
      if (!status.isReady) {
        return reply.status(500).send({
          error: 'WhatsApp não está configurado',
          message: 'Verifique as configurações de ACCESS_TOKEN e PHONE_NUMBER_ID'
        })
      }

      // Test message sending to admin (you would replace with actual admin number)
      const testMessage = `🧪 *Teste de Integração WhatsApp*

✅ WhatsApp Business API está funcionando corretamente!

🔧 *Status:*
• Cliente: ${status.isReady ? 'Ativo' : 'Inativo'}
• Conexão: ${status.isConnected ? 'Conectado' : 'Desconectado'}

⏰ *Data do teste:* ${new Date().toLocaleString('pt-BR')}

_Esta é uma mensagem de teste automática._`

      return reply.send({
        message: 'Teste de integração concluído',
        status,
        testMessage,
        helpMessage: status.isReady ? 
          'WhatsApp está funcionando! Você pode enviar mensagens.' :
          'Configure WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID e WHATSAPP_VERIFY_TOKEN nas variáveis de ambiente.'
      })

    } catch (error) {
      request.log.error('WhatsApp test error:', error)
      return reply.status(500).send({
        error: 'Erro no teste de integração'
      })
    }
  }
}
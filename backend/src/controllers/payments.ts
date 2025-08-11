import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { prisma } from '@/config/database.js'
import { PIXService } from '@/services/pix.js'
import { rateLimitService } from '@/config/redis.js'
import { WhatsAppService } from '@/services/whatsapp.js'

// Validation schemas
const createPaymentSchema = z.object({
  bookingId: z.string().min(1, 'ID da reserva é obrigatório'),
  method: z.enum(['PIX', 'CREDIT_CARD', 'DEBIT_CARD']).default('PIX'),
  amount: z.number().positive('Valor deve ser positivo'),
  installments: z.number().int().min(1).max(12).optional(),
})

const confirmPaymentSchema = z.object({
  paymentId: z.string().min(1, 'ID do pagamento é obrigatório'),
  transactionId: z.string().optional(),
})

const webhookSchema = z.object({
  id: z.string().optional(),
  live_mode: z.boolean().optional(),
  type: z.string().optional(),
  date_created: z.string().optional(),
  application_id: z.string().optional(),
  user_id: z.string().optional(),
  version: z.number().optional(),
  api_version: z.string().optional(),
  action: z.string().optional(),
  data: z.object({
    id: z.string()
  }).optional()
})

export class PaymentsController {
  private pixService = new PIXService()
  private whatsappService = new WhatsAppService()

  // Create payment (PIX or Card)
  async createPayment(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = createPaymentSchema.parse(request.body)
      const userId = request.user!.id

      // Rate limiting
      const rateLimit = await rateLimitService.checkRateLimit(`payment:${userId}`, 300, 5)
      if (!rateLimit.allowed) {
        return reply.status(429).send({
          error: 'Muitas tentativas',
          message: 'Aguarde alguns minutos antes de criar outro pagamento.'
        })
      }

      // Get booking details
      const booking = await prisma.booking.findFirst({
        where: {
          id: body.bookingId,
          guestId: userId,
          status: 'PENDING'
        },
        include: {
          property: {
            include: {
              host: {
                select: { id: true, name: true, email: true }
              }
            }
          },
          guest: {
            select: { id: true, name: true, email: true, phone: true }
          }
        }
      })

      if (!booking) {
        return reply.status(404).send({
          error: 'Reserva não encontrada',
          message: 'Reserva não encontrada ou não pode ser paga.'
        })
      }

      // Verify amount matches booking total
      if (Math.abs(body.amount - booking.totalPrice) > 0.01) {
        return reply.status(400).send({
          error: 'Valor incorreto',
          message: 'O valor do pagamento não confere com o total da reserva.'
        })
      }

      // Check if there's already a pending payment for this booking
      const existingPayment = await prisma.payment.findFirst({
        where: {
          bookingId: booking.id,
          status: { in: ['PENDING', 'PROCESSING'] }
        }
      })

      if (existingPayment) {
        return reply.status(400).send({
          error: 'Pagamento já iniciado',
          message: 'Já existe um pagamento em andamento para esta reserva.'
        })
      }

      // Create payment record
      const payment = await prisma.payment.create({
        data: {
          bookingId: booking.id,
          amount: body.amount,
          method: body.method,
          status: 'PENDING',
          currency: 'BRL',
          metadata: {
            installments: body.installments,
            userAgent: request.headers['user-agent'],
            ip: request.ip
          }
        }
      })

      let paymentResponse: any = null

      // Process PIX payment
      if (body.method === 'PIX') {
        try {
          const pixPayment = await this.pixService.createPayment({
            amount: body.amount,
            description: `Reserva ${booking.property.title} - HospedeFácil`,
            bookingId: booking.id,
            payerEmail: booking.guest.email,
            payerName: booking.guest.name,
            expiresIn: 1800 // 30 minutes
          })

          if (pixPayment) {
            // Update payment with PIX data
            await prisma.payment.update({
              where: { id: payment.id },
              data: {
                pixId: pixPayment.txid,
                pixKey: pixPayment.pixKey,
                qrCode: pixPayment.qrCode,
                externalId: pixPayment.txid,
                metadata: {
                  ...payment.metadata,
                  pixData: pixPayment
                }
              }
            })

            paymentResponse = {
              id: payment.id,
              amount: body.amount,
              method: 'PIX',
              status: 'PENDING',
              pix: {
                txid: pixPayment.txid,
                qrCode: pixPayment.qrCode,
                qrCodeImage: pixPayment.qrCodeImage,
                expiresAt: pixPayment.expiresAt,
                instructions: this.pixService.generateInstantPaymentText(body.amount, `Reserva ${booking.property.title}`)
              },
              booking: {
                id: booking.id,
                property: booking.property.title,
                checkIn: booking.checkIn,
                checkOut: booking.checkOut,
                nights: booking.nights,
                guests: booking.guests
              },
              expiresAt: pixPayment.expiresAt
            }

            // Start monitoring payment status
            this.pixService.monitorPaymentStatus(pixPayment.txid, 30)

            // Send WhatsApp notification with PIX QR code
            if (booking.guest.phone) {
              try {
                await this.whatsappService.sendPixPaymentInstructions(
                  booking.guest.phone,
                  booking.guest.name,
                  body.amount,
                  pixPayment.qrCode,
                  booking.property.title
                )
              } catch (error) {
                request.log.error('Failed to send WhatsApp PIX instructions:', error)
              }
            }
          }

        } catch (error) {
          request.log.error('PIX payment creation failed:', error)
          
          // Update payment status to failed
          await prisma.payment.update({
            where: { id: payment.id },
            data: { status: 'FAILED', failedAt: new Date() }
          })

          return reply.status(500).send({
            error: 'Erro PIX',
            message: 'Não foi possível criar o pagamento PIX. Tente novamente.'
          })
        }
      }

      // TODO: Implement credit card processing
      if (body.method === 'CREDIT_CARD' || body.method === 'DEBIT_CARD') {
        return reply.status(501).send({
          error: 'Não implementado',
          message: 'Pagamento com cartão será disponibilizado em breve.'
        })
      }

      return reply.status(201).send({
        message: 'Pagamento criado com sucesso!',
        payment: paymentResponse
      })

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Dados inválidos',
          details: error.errors
        })
      }

      request.log.error('Payment creation error:', error)
      return reply.status(500).send({
        error: 'Erro interno',
        message: 'Não foi possível processar o pagamento.'
      })
    }
  }

  // Get payment status
  async getPaymentStatus(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { paymentId } = request.params as { paymentId: string }
      const userId = request.user!.id

      const payment = await prisma.payment.findFirst({
        where: {
          id: paymentId,
          booking: {
            guestId: userId
          }
        },
        include: {
          booking: {
            include: {
              property: {
                select: { id: true, title: true }
              }
            }
          }
        }
      })

      if (!payment) {
        return reply.status(404).send({
          error: 'Pagamento não encontrado'
        })
      }

      // For PIX payments, check real-time status
      if (payment.method === 'PIX' && payment.pixId) {
        try {
          const pixStatus = await this.pixService.checkPaymentStatus(payment.pixId)
          
          if (pixStatus && pixStatus.status !== payment.status) {
            // Update local payment status
            await prisma.payment.update({
              where: { id: payment.id },
              data: { 
                status: pixStatus.status,
                processedAt: pixStatus.status === 'COMPLETED' ? new Date() : null
              }
            })

            // Update payment object for response
            payment.status = pixStatus.status as any
            if (pixStatus.status === 'COMPLETED') {
              payment.processedAt = new Date()
            }
          }
        } catch (error) {
          request.log.error('Failed to check PIX status:', error)
        }
      }

      return reply.send({
        payment: {
          id: payment.id,
          amount: payment.amount,
          method: payment.method,
          status: payment.status,
          createdAt: payment.createdAt,
          processedAt: payment.processedAt,
          booking: {
            id: payment.booking.id,
            property: payment.booking.property.title
          }
        }
      })

    } catch (error) {
      request.log.error('Get payment status error:', error)
      return reply.status(500).send({
        error: 'Erro interno',
        message: 'Não foi possível verificar o status do pagamento.'
      })
    }
  }

  // Mercado Pago webhook handler
  async handleMercadoPagoWebhook(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = webhookSchema.parse(request.body)

      // Mercado Pago sends different types of webhooks
      if (body.type === 'payment' && body.data?.id) {
        const paymentId = body.data.id

        // Get payment status from Mercado Pago
        const pixStatus = await this.pixService.checkPaymentStatus(paymentId)
        
        if (pixStatus) {
          await this.pixService.processWebhook(pixStatus)
        }
      }

      // Always return 200 OK to acknowledge webhook receipt
      return reply.status(200).send({ received: true })

    } catch (error) {
      request.log.error('Webhook processing error:', error)
      
      // Still return 200 to prevent Mercado Pago from retrying
      return reply.status(200).send({ received: true })
    }
  }

  // Get user payment history
  async getPaymentHistory(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = request.user!.id
      const { page = 1, limit = 10 } = request.query as any

      const skip = (page - 1) * limit

      const [payments, total] = await Promise.all([
        prisma.payment.findMany({
          where: {
            booking: {
              guestId: userId
            }
          },
          include: {
            booking: {
              include: {
                property: {
                  select: {
                    id: true,
                    title: true,
                    images: {
                      take: 1,
                      orderBy: { order: 'asc' },
                      select: { url: true }
                    }
                  }
                }
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit
        }),
        prisma.payment.count({
          where: {
            booking: {
              guestId: userId
            }
          }
        })
      ])

      return reply.send({
        payments: payments.map(payment => ({
          id: payment.id,
          amount: payment.amount,
          method: payment.method,
          status: payment.status,
          createdAt: payment.createdAt,
          processedAt: payment.processedAt,
          booking: {
            id: payment.booking.id,
            property: {
              id: payment.booking.property.id,
              title: payment.booking.property.title,
              image: payment.booking.property.images[0]?.url
            },
            checkIn: payment.booking.checkIn,
            checkOut: payment.booking.checkOut,
            nights: payment.booking.nights
          }
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      })

    } catch (error) {
      request.log.error('Payment history error:', error)
      return reply.status(500).send({
        error: 'Erro interno',
        message: 'Não foi possível carregar o histórico de pagamentos.'
      })
    }
  }

  // Cancel payment (for pending payments only)
  async cancelPayment(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { paymentId } = request.params as { paymentId: string }
      const userId = request.user!.id

      const payment = await prisma.payment.findFirst({
        where: {
          id: paymentId,
          booking: {
            guestId: userId
          },
          status: { in: ['PENDING', 'PROCESSING'] }
        },
        include: {
          booking: true
        }
      })

      if (!payment) {
        return reply.status(404).send({
          error: 'Pagamento não encontrado',
          message: 'Pagamento não encontrado ou não pode ser cancelado.'
        })
      }

      // Update payment and booking status
      await Promise.all([
        prisma.payment.update({
          where: { id: payment.id },
          data: { 
            status: 'CANCELLED',
            failedAt: new Date(),
            metadata: {
              ...payment.metadata,
              cancelReason: 'Cancelado pelo usuário'
            }
          }
        }),
        prisma.booking.update({
          where: { id: payment.bookingId },
          data: { status: 'CANCELLED' }
        })
      ])

      return reply.send({
        message: 'Pagamento cancelado com sucesso!'
      })

    } catch (error) {
      request.log.error('Cancel payment error:', error)
      return reply.status(500).send({
        error: 'Erro interno',
        message: 'Não foi possível cancelar o pagamento.'
      })
    }
  }

  // Generate payment receipt
  async getPaymentReceipt(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { paymentId } = request.params as { paymentId: string }
      const userId = request.user!.id

      const payment = await prisma.payment.findFirst({
        where: {
          id: paymentId,
          booking: {
            guestId: userId
          },
          status: 'COMPLETED'
        },
        include: {
          booking: {
            include: {
              property: {
                include: {
                  host: {
                    select: { name: true, email: true }
                  }
                }
              },
              guest: {
                select: { name: true, email: true }
              }
            }
          }
        }
      })

      if (!payment) {
        return reply.status(404).send({
          error: 'Comprovante não encontrado',
          message: 'Pagamento não encontrado ou ainda não foi concluído.'
        })
      }

      const receipt = this.pixService.generatePaymentSummary(payment, payment.booking)

      return reply.send({
        receipt: {
          ...receipt,
          receiptNumber: `HF${payment.id.slice(-8).toUpperCase()}`,
          generatedAt: new Date().toISOString(),
          guest: payment.booking.guest.name,
          host: payment.booking.property.host.name,
          platformFee: payment.booking.serviceFee,
          description: `Pagamento de hospedagem - ${payment.booking.property.title}`
        }
      })

    } catch (error) {
      request.log.error('Payment receipt error:', error)
      return reply.status(500).send({
        error: 'Erro interno',
        message: 'Não foi possível gerar o comprovante.'
      })
    }
  }
}
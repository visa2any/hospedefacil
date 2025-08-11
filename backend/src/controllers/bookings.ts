import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { prisma } from '@/config/database.js'
import { business } from '@/config/environment.js'
import { PIXService } from '@/services/pix.js'
import { EmailService } from '@/services/email.js'
import { WhatsAppService } from '@/services/whatsapp.js'
import { CalendarService } from '@/services/calendar.js'

// Validation schemas
const createBookingSchema = z.object({
  propertyId: z.string().min(1, 'ID da propriedade é obrigatório'),
  checkIn: z.string().datetime('Data de check-in inválida'),
  checkOut: z.string().datetime('Data de check-out inválida'),
  adults: z.number().int().min(1).max(20, 'Máximo 20 adultos'),
  children: z.number().int().min(0).max(10, 'Máximo 10 crianças').default(0),
  infants: z.number().int().min(0).max(5, 'Máximo 5 bebês').default(0),
  pets: z.number().int().min(0).max(5, 'Máximo 5 animais').default(0),
  guestName: z.string().min(2, 'Nome do hóspede é obrigatório').max(100),
  guestEmail: z.string().email('Email inválido'),
  guestPhone: z.string().optional(),
  message: z.string().max(1000, 'Mensagem muito longa').optional(),
  acceptTerms: z.boolean().refine(val => val === true, 'Você deve aceitar os termos'),
})

const updateBookingSchema = z.object({
  checkIn: z.string().datetime().optional(),
  checkOut: z.string().datetime().optional(),
  adults: z.number().int().min(1).max(20).optional(),
  children: z.number().int().min(0).max(10).optional(),
  infants: z.number().int().min(0).max(5).optional(),
  pets: z.number().int().min(0).max(5).optional(),
  guestName: z.string().min(2).max(100).optional(),
  guestEmail: z.string().email().optional(),
  guestPhone: z.string().optional(),
  message: z.string().max(1000).optional(),
})

const bookingQuerySchema = z.object({
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('10'),
  status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'IN_PROGRESS', 'NO_SHOW']).optional(),
  propertyId: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
})

export class BookingController {
  private pixService = new PIXService()
  private emailService = new EmailService()
  private whatsappService = new WhatsAppService()
  private calendarService = new CalendarService()

  // Create booking
  async createBooking(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = createBookingSchema.parse(request.body)
      const guestId = request.user!.id

      const checkInDate = new Date(body.checkIn)
      const checkOutDate = new Date(body.checkOut)
      const today = new Date()

      // Validation checks
      if (checkInDate <= today) {
        return reply.status(400).send({
          error: 'Data inválida',
          message: 'A data de check-in deve ser futura.'
        })
      }

      if (checkOutDate <= checkInDate) {
        return reply.status(400).send({
          error: 'Data inválida',
          message: 'A data de check-out deve ser posterior ao check-in.'
        })
      }

      const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24))
      
      if (nights > business.maxBookingDays) {
        return reply.status(400).send({
          error: 'Estadia muito longa',
          message: `Máximo de ${business.maxBookingDays} dias por reserva.`
        })
      }

      // Find property
      const property = await prisma.property.findUnique({
        where: { id: body.propertyId },
        include: {
          host: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            }
          }
        }
      })

      if (!property) {
        return reply.status(404).send({
          error: 'Propriedade não encontrada'
        })
      }

      if (property.status !== 'ACTIVE') {
        return reply.status(400).send({
          error: 'Propriedade indisponível',
          message: 'Esta propriedade não está disponível para reservas.'
        })
      }

      // Check guest capacity
      const totalGuests = body.adults + body.children + body.infants
      if (totalGuests > property.maxGuests) {
        return reply.status(400).send({
          error: 'Excesso de hóspedes',
          message: `Esta propriedade comporta no máximo ${property.maxGuests} hóspedes.`
        })
      }

      // Check minimum and maximum stay
      if (nights < property.minStay) {
        return reply.status(400).send({
          error: 'Estadia muito curta',
          message: `Estadia mínima de ${property.minStay} dia(s).`
        })
      }

      if (nights > property.maxStay) {
        return reply.status(400).send({
          error: 'Estadia muito longa',
          message: `Estadia máxima de ${property.maxStay} dia(s).`
        })
      }

      // Check pets policy
      if (body.pets > 0 && !property.petsAllowed) {
        return reply.status(400).send({
          error: 'Animais não permitidos',
          message: 'Esta propriedade não aceita animais de estimação.'
        })
      }

      // Check availability
      const unavailableDates = await prisma.propertyAvailability.findMany({
        where: {
          propertyId: body.propertyId,
          date: {
            gte: checkInDate,
            lt: checkOutDate,
          },
          isBlocked: true
        }
      })

      if (unavailableDates.length > 0) {
        return reply.status(400).send({
          error: 'Datas indisponíveis',
          message: 'Algumas datas selecionadas não estão disponíveis.'
        })
      }

      // Check for existing bookings
      const conflictingBookings = await prisma.booking.findMany({
        where: {
          propertyId: body.propertyId,
          status: { in: ['CONFIRMED', 'IN_PROGRESS'] },
          OR: [
            {
              AND: [
                { checkIn: { lte: checkInDate } },
                { checkOut: { gt: checkInDate } }
              ]
            },
            {
              AND: [
                { checkIn: { lt: checkOutDate } },
                { checkOut: { gte: checkOutDate } }
              ]
            },
            {
              AND: [
                { checkIn: { gte: checkInDate } },
                { checkOut: { lte: checkOutDate } }
              ]
            }
          ]
        }
      })

      if (conflictingBookings.length > 0) {
        return reply.status(400).send({
          error: 'Datas indisponíveis',
          message: 'Já existe uma reserva confirmada para essas datas.'
        })
      }

      // Calculate pricing
      const baseTotal = property.basePrice * nights
      const cleaningFee = property.cleaningFee
      const serviceFee = baseTotal * business.platformFeePercent
      const taxes = baseTotal * business.taxPercent
      const totalPrice = baseTotal + cleaningFee + serviceFee + taxes

      // Generate check-in code
      const checkInCode = this.generateCheckInCode()

      // Create booking
      const booking = await prisma.booking.create({
        data: {
          propertyId: body.propertyId,
          guestId,
          checkIn: checkInDate,
          checkOut: checkOutDate,
          nights,
          guests: totalGuests,
          basePrice: property.basePrice,
          cleaningFee,
          serviceFee,
          taxes,
          totalPrice,
          status: 'PENDING',
          guestName: body.guestName,
          guestEmail: body.guestEmail,
          guestPhone: body.guestPhone,
          message: body.message,
          checkInCode,
        },
        include: {
          property: {
            select: {
              id: true,
              title: true,
              street: true,
              city: true,
              state: true,
              checkInTime: true,
              checkOutTime: true,
            }
          },
          guest: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            }
          }
        }
      })

      // Create PIX payment
      const pixPayment = await this.pixService.createPayment({
        amount: totalPrice,
        description: `Reserva ${booking.id} - ${property.title}`,
        bookingId: booking.id,
        payerEmail: body.guestEmail,
        payerName: body.guestName,
        expiresIn: 30 * 60, // 30 minutes
      })

      if (pixPayment) {
        await prisma.payment.create({
          data: {
            bookingId: booking.id,
            amount: totalPrice,
            currency: 'BRL',
            method: 'PIX',
            status: 'PENDING',
            pixKey: pixPayment.pixKey,
            qrCode: pixPayment.qrCode,
            pixId: pixPayment.txid,
            externalId: pixPayment.txid,
            metadata: pixPayment,
          }
        })
      }

      // Send confirmation emails
      try {
        await this.emailService.sendBookingConfirmation(booking)
        await this.emailService.sendHostBookingNotification(booking, property.host)
      } catch (error) {
        request.log.error('Failed to send booking emails:', error)
      }

      // Send WhatsApp notifications
      try {
        if (body.guestPhone) {
          await this.whatsappService.sendBookingConfirmation(body.guestPhone, booking)
        }
        if (property.host.phone) {
          await this.whatsappService.sendHostBookingNotification(property.host.phone, booking)
        }
      } catch (error) {
        request.log.error('Failed to send WhatsApp notifications:', error)
      }

      return reply.status(201).send({
        message: 'Reserva criada com sucesso!',
        booking: {
          ...booking,
          pricing: {
            basePrice: property.basePrice,
            nights,
            baseTotal,
            cleaningFee,
            serviceFee,
            taxes,
            totalPrice,
          },
          payment: {
            pixKey: pixPayment?.pixKey,
            qrCode: pixPayment?.qrCode,
            expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
          }
        }
      })

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Dados inválidos',
          details: error.errors
        })
      }

      request.log.error('Create booking error:', error)
      return reply.status(500).send({
        error: 'Erro interno',
        message: 'Não foi possível criar a reserva.'
      })
    }
  }

  // Get bookings
  async getBookings(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = bookingQuerySchema.parse(request.query)
      const userId = request.user!.id
      const userRole = request.user!.role

      // Build where clause based on user role
      const where: any = {}

      if (userRole === 'HOST') {
        where.property = { hostId: userId }
      } else {
        where.guestId = userId
      }

      if (query.status) {
        where.status = query.status
      }

      if (query.propertyId) {
        where.propertyId = query.propertyId
      }

      if (query.startDate || query.endDate) {
        where.checkIn = {}
        if (query.startDate) where.checkIn.gte = new Date(query.startDate)
        if (query.endDate) where.checkIn.lte = new Date(query.endDate)
      }

      const totalCount = await prisma.booking.count({ where })

      const bookings = await prisma.booking.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          property: {
            select: {
              id: true,
              title: true,
              city: true,
              state: true,
              images: {
                take: 1,
                orderBy: { order: 'asc' }
              }
            }
          },
          guest: userRole === 'HOST' ? {
            select: {
              id: true,
              name: true,
              avatar: true,
            }
          } : false,
          host: userRole !== 'HOST' ? {
            select: {
              id: true,
              name: true,
              avatar: true,
              hostProfile: {
                select: {
                  isSuperHost: true,
                  averageRating: true,
                }
              }
            }
          } : false,
          payments: {
            select: {
              id: true,
              amount: true,
              method: true,
              status: true,
              createdAt: true,
            }
          },
          _count: {
            select: {
              messages: true,
            }
          }
        }
      })

      return reply.send({
        bookings: bookings.map(booking => ({
          ...booking,
          pricing: {
            basePrice: booking.basePrice,
            nights: booking.nights,
            baseTotal: booking.basePrice * booking.nights,
            cleaningFee: booking.cleaningFee,
            serviceFee: booking.serviceFee,
            taxes: booking.taxes,
            totalPrice: booking.totalPrice,
          },
          unreadMessages: booking._count.messages,
        })),
        pagination: {
          page: query.page,
          limit: query.limit,
          total: totalCount,
          pages: Math.ceil(totalCount / query.limit),
        }
      })

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Parâmetros inválidos',
          details: error.errors
        })
      }

      request.log.error('Get bookings error:', error)
      return reply.status(500).send({
        error: 'Erro interno',
        message: 'Não foi possível carregar as reservas.'
      })
    }
  }

  // Get single booking
  async getBooking(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string }
      const userId = request.user!.id
      const userRole = request.user!.role

      const booking = await prisma.booking.findUnique({
        where: { id },
        include: {
          property: {
            include: {
              images: {
                orderBy: { order: 'asc' }
              },
              host: {
                select: {
                  id: true,
                  name: true,
                  avatar: true,
                  phone: true,
                  hostProfile: {
                    select: {
                      isSuperHost: true,
                      averageRating: true,
                      responseRate: true,
                    }
                  }
                }
              }
            }
          },
          guest: {
            select: {
              id: true,
              name: true,
              avatar: true,
              phone: true,
            }
          },
          payments: {
            orderBy: { createdAt: 'desc' }
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 50,
            include: {
              sender: {
                select: {
                  id: true,
                  name: true,
                  avatar: true,
                }
              }
            }
          }
        }
      })

      if (!booking) {
        return reply.status(404).send({
          error: 'Reserva não encontrada'
        })
      }

      // Check permissions
      const isGuest = booking.guestId === userId
      const isHost = booking.property.host.id === userId
      const isAdmin = userRole === 'ADMIN'

      if (!isGuest && !isHost && !isAdmin) {
        return reply.status(403).send({
          error: 'Acesso negado',
          message: 'Você não tem permissão para ver esta reserva.'
        })
      }

      return reply.send({
        ...booking,
        pricing: {
          basePrice: booking.basePrice,
          nights: booking.nights,
          baseTotal: booking.basePrice * booking.nights,
          cleaningFee: booking.cleaningFee,
          serviceFee: booking.serviceFee,
          taxes: booking.taxes,
          totalPrice: booking.totalPrice,
        },
      })

    } catch (error) {
      request.log.error('Get booking error:', error)
      return reply.status(500).send({
        error: 'Erro interno',
        message: 'Não foi possível carregar a reserva.'
      })
    }
  }

  // Update booking
  async updateBooking(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string }
      const body = updateBookingSchema.parse(request.body)
      const userId = request.user!.id

      const booking = await prisma.booking.findUnique({
        where: { id },
        include: {
          property: {
            include: {
              host: {
                select: { id: true }
              }
            }
          }
        }
      })

      if (!booking) {
        return reply.status(404).send({
          error: 'Reserva não encontrada'
        })
      }

      // Check permissions and status
      const isGuest = booking.guestId === userId
      const isHost = booking.property.host.id === userId

      if (!isGuest && !isHost) {
        return reply.status(403).send({
          error: 'Acesso negado'
        })
      }

      if (booking.status !== 'PENDING') {
        return reply.status(400).send({
          error: 'Não é possível editar',
          message: 'Apenas reservas pendentes podem ser editadas.'
        })
      }

      // Validate date changes
      if (body.checkIn || body.checkOut) {
        const checkInDate = body.checkIn ? new Date(body.checkIn) : booking.checkIn
        const checkOutDate = body.checkOut ? new Date(body.checkOut) : booking.checkOut

        if (checkOutDate <= checkInDate) {
          return reply.status(400).send({
            error: 'Data inválida',
            message: 'A data de check-out deve ser posterior ao check-in.'
          })
        }

        // Check availability for new dates
        if (body.checkIn || body.checkOut) {
          const conflicts = await this.checkAvailability(booking.propertyId, checkInDate, checkOutDate, booking.id)
          if (conflicts) {
            return reply.status(400).send({
              error: 'Datas indisponíveis',
              message: 'As novas datas não estão disponíveis.'
            })
          }
        }

        // Recalculate pricing if dates changed
        if (body.checkIn || body.checkOut) {
          const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24))
          const baseTotal = booking.basePrice * nights
          const serviceFee = baseTotal * business.platformFeePercent
          const taxes = baseTotal * business.taxPercent
          const totalPrice = baseTotal + booking.cleaningFee + serviceFee + taxes

          body.nights = nights
          body.serviceFee = serviceFee
          body.taxes = taxes
          body.totalPrice = totalPrice
        }
      }

      // Update guest count validation
      if (body.adults !== undefined || body.children !== undefined || body.infants !== undefined) {
        const totalGuests = (body.adults || booking.guests) + 
                          (body.children || 0) + 
                          (body.infants || 0)
        
        if (totalGuests > booking.property.maxGuests) {
          return reply.status(400).send({
            error: 'Excesso de hóspedes',
            message: `Esta propriedade comporta no máximo ${booking.property.maxGuests} hóspedes.`
          })
        }

        body.guests = totalGuests
      }

      const updatedBooking = await prisma.booking.update({
        where: { id },
        data: body,
        include: {
          property: {
            select: {
              id: true,
              title: true,
              city: true,
              state: true,
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
      })

      return reply.send({
        message: 'Reserva atualizada com sucesso!',
        booking: updatedBooking
      })

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Dados inválidos',
          details: error.errors
        })
      }

      request.log.error('Update booking error:', error)
      return reply.status(500).send({
        error: 'Erro interno',
        message: 'Não foi possível atualizar a reserva.'
      })
    }
  }

  // Cancel booking
  async cancelBooking(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string }
      const userId = request.user!.id

      const booking = await prisma.booking.findUnique({
        where: { id },
        include: {
          property: {
            include: {
              host: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  phone: true,
                }
              }
            }
          },
          guest: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            }
          },
          payments: {
            where: { status: 'COMPLETED' }
          }
        }
      })

      if (!booking) {
        return reply.status(404).send({
          error: 'Reserva não encontrada'
        })
      }

      // Check permissions
      const isGuest = booking.guestId === userId
      const isHost = booking.property.host.id === userId

      if (!isGuest && !isHost) {
        return reply.status(403).send({
          error: 'Acesso negado'
        })
      }

      if (booking.status === 'CANCELLED') {
        return reply.status(400).send({
          error: 'Reserva já cancelada'
        })
      }

      if (booking.status === 'COMPLETED') {
        return reply.status(400).send({
          error: 'Não é possível cancelar',
          message: 'Esta reserva já foi concluída.'
        })
      }

      // Calculate refund based on cancellation policy
      const now = new Date()
      const checkIn = new Date(booking.checkIn)
      const hoursUntilCheckIn = (checkIn.getTime() - now.getTime()) / (1000 * 60 * 60)
      
      let refundAmount = 0
      let refundPercentage = 0

      if (hoursUntilCheckIn >= business.cancellationWindowHours) {
        // Full refund if cancelled more than 24 hours before check-in
        refundPercentage = 100
        refundAmount = booking.totalPrice
      } else if (hoursUntilCheckIn >= 0) {
        // 50% refund if cancelled less than 24 hours before check-in
        refundPercentage = 50
        refundAmount = booking.totalPrice * 0.5
      }
      // No refund if cancelled after check-in

      // Update booking status
      await prisma.booking.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          // Store cancellation details in a JSON field if needed
        }
      })

      // Process refund if applicable
      if (refundAmount > 0 && booking.payments.length > 0) {
        try {
          for (const payment of booking.payments) {
            await this.pixService.refundPayment(payment.externalId!, refundAmount)
            
            await prisma.payment.create({
              data: {
                bookingId: booking.id,
                amount: -refundAmount, // Negative amount for refund
                currency: 'BRL',
                method: 'PIX',
                status: 'COMPLETED',
                metadata: { type: 'refund', originalPaymentId: payment.id },
              }
            })
          }
        } catch (refundError) {
          request.log.error('Refund processing failed:', refundError)
        }
      }

      // Send cancellation notifications
      try {
        if (isGuest) {
          await this.emailService.sendCancellationConfirmation(booking.guest, booking, refundAmount)
          await this.emailService.sendHostCancellationNotification(booking.property.host, booking)
        } else {
          await this.emailService.sendGuestCancellationNotification(booking.guest, booking, refundAmount)
        }
      } catch (error) {
        request.log.error('Failed to send cancellation emails:', error)
      }

      // Send WhatsApp notifications
      try {
        if (booking.guest.phone) {
          await this.whatsappService.sendCancellationNotification(booking.guest.phone, booking, refundAmount)
        }
        if (booking.property.host.phone && isGuest) {
          await this.whatsappService.sendHostCancellationNotification(booking.property.host.phone, booking)
        }
      } catch (error) {
        request.log.error('Failed to send WhatsApp notifications:', error)
      }

      return reply.send({
        message: 'Reserva cancelada com sucesso!',
        refund: {
          percentage: refundPercentage,
          amount: refundAmount,
        }
      })

    } catch (error) {
      request.log.error('Cancel booking error:', error)
      return reply.status(500).send({
        error: 'Erro interno',
        message: 'Não foi possível cancelar a reserva.'
      })
    }
  }

  // Confirm booking (host only)
  async confirmBooking(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string }
      const userId = request.user!.id

      const booking = await prisma.booking.findUnique({
        where: { id },
        include: {
          property: {
            select: {
              hostId: true,
              title: true,
            }
          },
          guest: {
            select: {
              name: true,
              email: true,
              phone: true,
            }
          }
        }
      })

      if (!booking) {
        return reply.status(404).send({
          error: 'Reserva não encontrada'
        })
      }

      if (booking.property.hostId !== userId) {
        return reply.status(403).send({
          error: 'Acesso negado'
        })
      }

      if (booking.status !== 'PENDING') {
        return reply.status(400).send({
          error: 'Status inválido',
          message: 'Apenas reservas pendentes podem ser confirmadas.'
        })
      }

      // Update booking status
      const updatedBooking = await prisma.booking.update({
        where: { id },
        data: { status: 'CONFIRMED' },
      })

      // Block dates in calendar
      await this.calendarService.blockDates(
        booking.propertyId,
        booking.checkIn,
        booking.checkOut
      )

      // Send confirmation notifications
      try {
        await this.emailService.sendBookingConfirmed(booking.guest, booking)
        if (booking.guest.phone) {
          await this.whatsappService.sendBookingConfirmed(booking.guest.phone, booking)
        }
      } catch (error) {
        request.log.error('Failed to send confirmation notifications:', error)
      }

      return reply.send({
        message: 'Reserva confirmada com sucesso!',
        booking: updatedBooking
      })

    } catch (error) {
      request.log.error('Confirm booking error:', error)
      return reply.status(500).send({
        error: 'Erro interno',
        message: 'Não foi possível confirmar a reserva.'
      })
    }
  }

  // Check-in
  async checkIn(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string }
      const { checkInCode } = request.body as { checkInCode?: string }
      const userId = request.user!.id

      const booking = await prisma.booking.findUnique({
        where: { id },
        include: {
          property: {
            select: {
              hostId: true,
              checkInTime: true,
            }
          }
        }
      })

      if (!booking) {
        return reply.status(404).send({
          error: 'Reserva não encontrada'
        })
      }

      // Check permissions
      const isGuest = booking.guestId === userId
      const isHost = booking.property.hostId === userId

      if (!isGuest && !isHost) {
        return reply.status(403).send({
          error: 'Acesso negado'
        })
      }

      if (booking.status !== 'CONFIRMED') {
        return reply.status(400).send({
          error: 'Status inválido',
          message: 'Apenas reservas confirmadas permitem check-in.'
        })
      }

      // Validate check-in code for guests
      if (isGuest && (!checkInCode || checkInCode !== booking.checkInCode)) {
        return reply.status(400).send({
          error: 'Código inválido',
          message: 'Código de check-in incorreto.'
        })
      }

      // Check if it's check-in day
      const today = new Date()
      const checkInDate = new Date(booking.checkIn)
      
      if (today.toDateString() !== checkInDate.toDateString()) {
        return reply.status(400).send({
          error: 'Data inválida',
          message: 'Check-in só é permitido no dia da reserva.'
        })
      }

      // Update booking
      const updatedBooking = await prisma.booking.update({
        where: { id },
        data: {
          status: 'IN_PROGRESS',
          actualCheckIn: new Date(),
        }
      })

      return reply.send({
        message: 'Check-in realizado com sucesso!',
        booking: updatedBooking
      })

    } catch (error) {
      request.log.error('Check-in error:', error)
      return reply.status(500).send({
        error: 'Erro interno',
        message: 'Não foi possível realizar o check-in.'
      })
    }
  }

  // Check-out
  async checkOut(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string }
      const userId = request.user!.id

      const booking = await prisma.booking.findUnique({
        where: { id },
        include: {
          property: {
            select: {
              hostId: true,
              checkOutTime: true,
            }
          }
        }
      })

      if (!booking) {
        return reply.status(404).send({
          error: 'Reserva não encontrada'
        })
      }

      // Check permissions
      const isGuest = booking.guestId === userId
      const isHost = booking.property.hostId === userId

      if (!isGuest && !isHost) {
        return reply.status(403).send({
          error: 'Acesso negado'
        })
      }

      if (booking.status !== 'IN_PROGRESS') {
        return reply.status(400).send({
          error: 'Status inválido',
          message: 'Check-out só é permitido para reservas em andamento.'
        })
      }

      // Update booking
      const updatedBooking = await prisma.booking.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          actualCheckOut: new Date(),
        }
      })

      return reply.send({
        message: 'Check-out realizado com sucesso!',
        booking: updatedBooking
      })

    } catch (error) {
      request.log.error('Check-out error:', error)
      return reply.status(500).send({
        error: 'Erro interno',
        message: 'Não foi possível realizar o check-out.'
      })
    }
  }

  // Helper methods
  private generateCheckInCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase()
  }

  private async checkAvailability(
    propertyId: string, 
    checkIn: Date, 
    checkOut: Date, 
    excludeBookingId?: string
  ): Promise<boolean> {
    const where: any = {
      propertyId,
      status: { in: ['CONFIRMED', 'IN_PROGRESS'] },
      OR: [
        {
          AND: [
            { checkIn: { lte: checkIn } },
            { checkOut: { gt: checkIn } }
          ]
        },
        {
          AND: [
            { checkIn: { lt: checkOut } },
            { checkOut: { gte: checkOut } }
          ]
        },
        {
          AND: [
            { checkIn: { gte: checkIn } },
            { checkOut: { lte: checkOut } }
          ]
        }
      ]
    }

    if (excludeBookingId) {
      where.id = { not: excludeBookingId }
    }

    const conflictingBooking = await prisma.booking.findFirst({ where })
    return !!conflictingBooking
  }
}
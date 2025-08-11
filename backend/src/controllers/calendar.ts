import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { prisma } from '@/config/database.js'
import { CalendarService } from '@/services/calendar.js'

// Validation schemas
const dateRangeSchema = z.object({
  propertyId: z.string().min(1, 'ID da propriedade é obrigatório'),
  startDate: z.string().datetime('Data inicial inválida'),
  endDate: z.string().datetime('Data final inválida'),
  notes: z.string().max(500).optional()
})

const customPricingSchema = z.object({
  propertyId: z.string().min(1, 'ID da propriedade é obrigatório'),
  startDate: z.string().datetime('Data inicial inválida'),
  endDate: z.string().datetime('Data final inválida'),
  price: z.number().positive('Preço deve ser positivo')
})

const bulkUpdateSchema = z.object({
  propertyId: z.string().min(1, 'ID da propriedade é obrigatório'),
  updates: z.array(z.object({
    date: z.string().datetime('Data inválida'),
    isBlocked: z.boolean(),
    price: z.number().positive().optional(),
    minStay: z.number().int().positive().optional(),
    advanceNotice: z.number().int().min(0).optional(),
    notes: z.string().max(500).optional()
  })).min(1, 'Pelo menos uma atualização é necessária')
})

const calendarRuleSchema = z.object({
  propertyId: z.string().min(1, 'ID da propriedade é obrigatório'),
  type: z.enum(['BLOCK', 'UNBLOCK', 'PRICE', 'MIN_STAY', 'ADVANCE_NOTICE']),
  startDate: z.string().datetime('Data inicial inválida'),
  endDate: z.string().datetime('Data final inválida'),
  value: z.number().optional(),
  recurring: z.object({
    frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']),
    interval: z.number().int().positive().default(1),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
    endDate: z.string().datetime().optional()
  }).optional()
})

const calendarSyncSchema = z.object({
  propertyId: z.string().min(1, 'ID da propriedade é obrigatório'),
  externalCalendarUrl: z.string().url('URL inválida'),
  syncDirection: z.enum(['IMPORT', 'EXPORT', 'BIDIRECTIONAL']),
  provider: z.enum(['AIRBNB', 'BOOKING', 'VRBO', 'ICAL', 'GOOGLE']),
  isActive: z.boolean().default(true)
})

const availabilityQuerySchema = z.object({
  startDate: z.string().datetime('Data inicial inválida').optional(),
  endDate: z.string().datetime('Data final inválida').optional(),
  months: z.number().int().min(1).max(12).default(3)
})

export class CalendarController {
  private calendarService = new CalendarService()

  // Get property availability
  async getAvailability(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { propertyId } = request.params as { propertyId: string }
      const query = availabilityQuerySchema.parse(request.query)
      const hostId = request.user!.id

      // Verify property ownership
      const property = await prisma.property.findFirst({
        where: {
          id: propertyId,
          hostId: hostId
        },
        select: {
          id: true,
          title: true,
          basePrice: true,
          minStay: true
        }
      })

      if (!property) {
        return reply.status(404).send({
          error: 'Propriedade não encontrada'
        })
      }

      // Calculate date range
      const startDate = query.startDate ? new Date(query.startDate) : new Date()
      const endDate = query.endDate 
        ? new Date(query.endDate) 
        : new Date(Date.now() + query.months * 30 * 24 * 60 * 60 * 1000)

      const availability = await this.calendarService.getAvailability(propertyId, startDate, endDate)

      // Group by month for better UI display
      const monthlyAvailability = this.groupAvailabilityByMonth(availability)

      return reply.send({
        property: {
          id: property.id,
          title: property.title,
          basePrice: property.basePrice,
          minStay: property.minStay
        },
        period: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          totalDays: availability.length
        },
        availability: {
          daily: availability,
          monthly: monthlyAvailability
        },
        summary: {
          availableDays: availability.filter(a => a.available).length,
          blockedDays: availability.filter(a => a.blocked).length,
          bookedDays: availability.filter(a => a.booked).length,
          customPricingDays: availability.filter(a => a.price !== property.basePrice).length
        }
      })

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Parâmetros inválidos',
          details: error.errors
        })
      }

      request.log.error('Get availability error:', error)
      return reply.status(500).send({
        error: 'Erro interno',
        message: 'Não foi possível carregar a disponibilidade.'
      })
    }
  }

  // Block dates
  async blockDates(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = dateRangeSchema.parse(request.body)
      const hostId = request.user!.id

      // Verify property ownership
      await this.verifyPropertyOwnership(body.propertyId, hostId)

      const success = await this.calendarService.blockDates(
        body.propertyId,
        new Date(body.startDate),
        new Date(body.endDate),
        body.notes
      )

      if (!success) {
        return reply.status(500).send({
          error: 'Erro interno',
          message: 'Não foi possível bloquear as datas.'
        })
      }

      return reply.send({
        message: 'Datas bloqueadas com sucesso!'
      })

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Dados inválidos',
          details: error.errors
        })
      }

      request.log.error('Block dates error:', error)
      return reply.status(500).send({
        error: 'Erro interno',
        message: 'Não foi possível bloquear as datas.'
      })
    }
  }

  // Unblock dates
  async unblockDates(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = dateRangeSchema.parse(request.body)
      const hostId = request.user!.id

      await this.verifyPropertyOwnership(body.propertyId, hostId)

      const success = await this.calendarService.unblockDates(
        body.propertyId,
        new Date(body.startDate),
        new Date(body.endDate)
      )

      if (!success) {
        return reply.status(500).send({
          error: 'Erro interno',
          message: 'Não foi possível desbloquear as datas.'
        })
      }

      return reply.send({
        message: 'Datas desbloqueadas com sucesso!'
      })

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Dados inválidos',
          details: error.errors
        })
      }

      request.log.error('Unblock dates error:', error)
      return reply.status(500).send({
        error: 'Erro interno',
        message: 'Não foi possível desbloquear as datas.'
      })
    }
  }

  // Set custom pricing
  async setCustomPricing(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = customPricingSchema.parse(request.body)
      const hostId = request.user!.id

      await this.verifyPropertyOwnership(body.propertyId, hostId)

      const success = await this.calendarService.setCustomPricing(
        body.propertyId,
        new Date(body.startDate),
        new Date(body.endDate),
        body.price
      )

      if (!success) {
        return reply.status(500).send({
          error: 'Erro interno',
          message: 'Não foi possível definir a precificação personalizada.'
        })
      }

      return reply.send({
        message: 'Precificação personalizada definida com sucesso!'
      })

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Dados inválidos',
          details: error.errors
        })
      }

      request.log.error('Set custom pricing error:', error)
      return reply.status(500).send({
        error: 'Erro interno',
        message: 'Não foi possível definir a precificação personalizada.'
      })
    }
  }

  // Bulk update availability
  async bulkUpdateAvailability(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = bulkUpdateSchema.parse(request.body)
      const hostId = request.user!.id

      await this.verifyPropertyOwnership(body.propertyId, hostId)

      const updates = body.updates.map(update => ({
        propertyId: body.propertyId,
        date: new Date(update.date),
        isBlocked: update.isBlocked,
        price: update.price,
        minStay: update.minStay,
        advanceNotice: update.advanceNotice,
        notes: update.notes
      }))

      const success = await this.calendarService.bulkUpdateAvailability(updates)

      if (!success) {
        return reply.status(500).send({
          error: 'Erro interno',
          message: 'Não foi possível realizar as atualizações em lote.'
        })
      }

      return reply.send({
        message: `${updates.length} atualizações aplicadas com sucesso!`
      })

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Dados inválidos',
          details: error.errors
        })
      }

      request.log.error('Bulk update availability error:', error)
      return reply.status(500).send({
        error: 'Erro interno',
        message: 'Não foi possível realizar as atualizações em lote.'
      })
    }
  }

  // Apply calendar rule
  async applyCalendarRule(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = calendarRuleSchema.parse(request.body)
      const hostId = request.user!.id

      await this.verifyPropertyOwnership(body.propertyId, hostId)

      const rule = {
        type: body.type,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        value: body.value,
        recurring: body.recurring ? {
          frequency: body.recurring.frequency,
          interval: body.recurring.interval,
          daysOfWeek: body.recurring.daysOfWeek,
          endDate: body.recurring.endDate ? new Date(body.recurring.endDate) : undefined
        } : undefined
      }

      const success = await this.calendarService.applyCalendarRule(body.propertyId, rule)

      if (!success) {
        return reply.status(500).send({
          error: 'Erro interno',
          message: 'Não foi possível aplicar a regra de calendário.'
        })
      }

      return reply.send({
        message: `Regra de calendário ${body.recurring ? 'recorrente' : ''} aplicada com sucesso!`
      })

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Dados inválidos',
          details: error.errors
        })
      }

      request.log.error('Apply calendar rule error:', error)
      return reply.status(500).send({
        error: 'Erro interno',
        message: 'Não foi possível aplicar a regra de calendário.'
      })
    }
  }

  // Get iCal feed
  async getICalFeed(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { propertyId } = request.params as { propertyId: string }

      // Verify property exists and is active
      const property = await prisma.property.findUnique({
        where: { id: propertyId, status: 'ACTIVE' }
      })

      if (!property) {
        return reply.status(404).send({
          error: 'Propriedade não encontrada'
        })
      }

      const icalFeed = await this.calendarService.generateICalFeed(propertyId)

      reply
        .type('text/calendar; charset=utf-8')
        .header('Content-Disposition', `attachment; filename="${propertyId}.ics"`)
        .header('Cache-Control', 'public, max-age=3600')
        .send(icalFeed)

    } catch (error) {
      request.log.error('Get iCal feed error:', error)
      return reply.status(500).send({
        error: 'Erro interno',
        message: 'Não foi possível gerar o feed do calendário.'
      })
    }
  }

  // Setup calendar synchronization
  async setupCalendarSync(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = calendarSyncSchema.parse(request.body)
      const hostId = request.user!.id

      await this.verifyPropertyOwnership(body.propertyId, hostId)

      const success = await this.calendarService.setupCalendarSync(body)

      if (!success) {
        return reply.status(500).send({
          error: 'Erro interno',
          message: 'Não foi possível configurar a sincronização do calendário.'
        })
      }

      return reply.send({
        message: 'Sincronização do calendário configurada com sucesso!'
      })

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Dados inválidos',
          details: error.errors
        })
      }

      request.log.error('Setup calendar sync error:', error)
      return reply.status(500).send({
        error: 'Erro interno',
        message: 'Não foi possível configurar a sincronização do calendário.'
      })
    }
  }

  // Import external calendar
  async importExternalCalendar(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { propertyId } = request.params as { propertyId: string }
      const { icalUrl } = request.body as { icalUrl: string }
      const hostId = request.user!.id

      if (!icalUrl || !icalUrl.startsWith('http')) {
        return reply.status(400).send({
          error: 'URL inválida',
          message: 'Por favor, forneça uma URL válida para o calendário iCal.'
        })
      }

      await this.verifyPropertyOwnership(propertyId, hostId)

      const success = await this.calendarService.importExternalCalendar(propertyId, icalUrl)

      if (!success) {
        return reply.status(500).send({
          error: 'Erro na importação',
          message: 'Não foi possível importar o calendário externo. Verifique a URL e tente novamente.'
        })
      }

      return reply.send({
        message: 'Calendário externo importado com sucesso!'
      })

    } catch (error) {
      request.log.error('Import external calendar error:', error)
      return reply.status(500).send({
        error: 'Erro interno',
        message: 'Não foi possível importar o calendário externo.'
      })
    }
  }

  // Get calendar sync status
  async getCalendarSyncStatus(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { propertyId } = request.params as { propertyId: string }
      const hostId = request.user!.id

      await this.verifyPropertyOwnership(propertyId, hostId)

      const syncConfigs = await prisma.calendarSyncConfig.findMany({
        where: { propertyId },
        orderBy: { createdAt: 'desc' }
      })

      const syncLogs = await prisma.calendarSync.findMany({
        where: { propertyId },
        orderBy: { lastSyncAt: 'desc' },
        take: 10
      })

      return reply.send({
        syncConfigs,
        syncLogs,
        summary: {
          totalConfigs: syncConfigs.length,
          activeConfigs: syncConfigs.filter(c => c.isActive).length,
          lastSyncAt: syncLogs.length > 0 ? syncLogs[0].lastSyncAt : null,
          totalSyncs: syncLogs.length
        }
      })

    } catch (error) {
      request.log.error('Get calendar sync status error:', error)
      return reply.status(500).send({
        error: 'Erro interno',
        message: 'Não foi possível carregar o status de sincronização.'
      })
    }
  }

  // Get availability templates
  async getAvailabilityTemplates(request: FastifyRequest, reply: FastifyReply) {
    try {
      const templates = await prisma.availabilityTemplate.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' }
      })

      return reply.send({
        templates: templates.map(template => ({
          id: template.id,
          name: template.name,
          rulesCount: JSON.parse(template.rules).length,
          createdAt: template.createdAt
        }))
      })

    } catch (error) {
      request.log.error('Get availability templates error:', error)
      return reply.status(500).send({
        error: 'Erro interno',
        message: 'Não foi possível carregar os templates.'
      })
    }
  }

  // Apply availability template
  async applyTemplate(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { propertyId, templateId } = request.params as { propertyId: string, templateId: string }
      const hostId = request.user!.id

      await this.verifyPropertyOwnership(propertyId, hostId)

      const success = await this.calendarService.applyTemplate(propertyId, templateId)

      if (!success) {
        return reply.status(500).send({
          error: 'Erro interno',
          message: 'Não foi possível aplicar o template.'
        })
      }

      return reply.send({
        message: 'Template aplicado com sucesso!'
      })

    } catch (error) {
      request.log.error('Apply template error:', error)
      return reply.status(500).send({
        error: 'Erro interno',
        message: 'Não foi possível aplicar o template.'
      })
    }
  }

  // Helper methods
  private async verifyPropertyOwnership(propertyId: string, hostId: string): Promise<void> {
    const property = await prisma.property.findFirst({
      where: { id: propertyId, hostId }
    })

    if (!property) {
      throw new Error('Propriedade não encontrada ou acesso negado')
    }
  }

  private groupAvailabilityByMonth(availability: any[]): any[] {
    const months = new Map()

    availability.forEach(day => {
      const date = new Date(day.date)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      
      if (!months.has(monthKey)) {
        months.set(monthKey, {
          year: date.getFullYear(),
          month: date.getMonth() + 1,
          monthName: date.toLocaleString('pt-BR', { month: 'long' }),
          days: [],
          stats: {
            available: 0,
            blocked: 0,
            booked: 0,
            totalDays: 0
          }
        })
      }

      const monthData = months.get(monthKey)
      monthData.days.push(day)
      monthData.stats.totalDays++
      
      if (day.available) monthData.stats.available++
      if (day.blocked) monthData.stats.blocked++
      if (day.booked) monthData.stats.booked++
    })

    return Array.from(months.values())
  }
}
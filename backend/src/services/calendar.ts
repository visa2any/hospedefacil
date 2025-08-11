import { prisma } from '@/config/database.js'
import { PricingService } from '@/services/pricing.js'
import { cacheService } from '@/config/redis.js'
import ical from 'ical-generator'
import axios from 'axios'

interface CalendarRule {
  type: 'BLOCK' | 'UNBLOCK' | 'PRICE' | 'MIN_STAY' | 'ADVANCE_NOTICE'
  startDate: Date
  endDate: Date
  value?: number | boolean
  recurring?: {
    frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'
    interval?: number
    daysOfWeek?: number[] // 0=Sunday, 1=Monday, etc.
    endDate?: Date
  }
}

interface AvailabilityUpdate {
  propertyId: string
  date: Date
  isBlocked: boolean
  price?: number
  minStay?: number
  advanceNotice?: number
  notes?: string
}

interface CalendarSyncConfig {
  propertyId: string
  externalCalendarUrl: string
  syncDirection: 'IMPORT' | 'EXPORT' | 'BIDIRECTIONAL'
  provider: 'AIRBNB' | 'BOOKING' | 'VRBO' | 'ICAL' | 'GOOGLE'
  isActive: boolean
}

export class CalendarService {
  private pricingService = new PricingService()

  // Block specific dates or date ranges
  async blockDates(propertyId: string, startDate: Date, endDate: Date, notes?: string): Promise<boolean> {
    try {
      const dates = this.generateDateRange(startDate, endDate)
      
      const updates = dates.map(date => ({
        propertyId_date: {
          propertyId,
          date
        },
        isBlocked: true,
        notes,
        updatedAt: new Date()
      }))

      await Promise.all(updates.map(update =>
        prisma.propertyAvailability.upsert({
          where: update.propertyId_date,
          update: {
            isBlocked: update.isBlocked,
            notes: update.notes,
            updatedAt: update.updatedAt
          },
          create: {
            propertyId,
            date: update.propertyId_date.date,
            isBlocked: update.isBlocked,
            notes: update.notes,
            price: null // Will use property base price
          }
        })
      ))

      // Invalidate cache
      await this.invalidateAvailabilityCache(propertyId)

      return true
    } catch (error) {
      console.error('Error blocking dates:', error)
      return false
    }
  }

  // Unblock specific dates
  async unblockDates(propertyId: string, startDate: Date, endDate: Date): Promise<boolean> {
    try {
      const dates = this.generateDateRange(startDate, endDate)
      
      const updates = dates.map(date => ({
        propertyId_date: {
          propertyId,
          date
        },
        isBlocked: false,
        notes: null,
        updatedAt: new Date()
      }))

      await Promise.all(updates.map(update =>
        prisma.propertyAvailability.upsert({
          where: update.propertyId_date,
          update: {
            isBlocked: update.isBlocked,
            notes: update.notes,
            updatedAt: update.updatedAt
          },
          create: {
            propertyId,
            date: update.propertyId_date.date,
            isBlocked: update.isBlocked,
            notes: update.notes,
            price: null
          }
        })
      ))

      await this.invalidateAvailabilityCache(propertyId)
      return true
    } catch (error) {
      console.error('Error unblocking dates:', error)
      return false
    }
  }

  // Set custom pricing for specific dates
  async setCustomPricing(propertyId: string, startDate: Date, endDate: Date, price: number): Promise<boolean> {
    try {
      const dates = this.generateDateRange(startDate, endDate)
      
      await Promise.all(dates.map(date =>
        prisma.propertyAvailability.upsert({
          where: {
            propertyId_date: {
              propertyId,
              date
            }
          },
          update: {
            price,
            updatedAt: new Date()
          },
          create: {
            propertyId,
            date,
            price,
            isBlocked: false
          }
        })
      ))

      await this.invalidateAvailabilityCache(propertyId)
      return true
    } catch (error) {
      console.error('Error setting custom pricing:', error)
      return false
    }
  }

  // Apply calendar rules (recurring patterns)
  async applyCalendarRule(propertyId: string, rule: CalendarRule): Promise<boolean> {
    try {
      if (rule.recurring) {
        return await this.applyRecurringRule(propertyId, rule)
      } else {
        return await this.applySingleRule(propertyId, rule)
      }
    } catch (error) {
      console.error('Error applying calendar rule:', error)
      return false
    }
  }

  // Get availability for a date range
  async getAvailability(propertyId: string, startDate: Date, endDate: Date): Promise<any[]> {
    try {
      const cacheKey = `availability:${propertyId}:${startDate.toISOString()}:${endDate.toISOString()}`
      const cached = await cacheService.get(cacheKey)
      
      if (cached) {
        return JSON.parse(cached)
      }

      // Get property base price
      const property = await prisma.property.findUnique({
        where: { id: propertyId },
        select: { basePrice: true, minStay: true }
      })

      if (!property) {
        throw new Error('Property not found')
      }

      // Get availability data
      const availability = await prisma.propertyAvailability.findMany({
        where: {
          propertyId,
          date: {
            gte: startDate,
            lte: endDate
          }
        },
        orderBy: { date: 'asc' }
      })

      // Get existing bookings for the period
      const bookings = await prisma.booking.findMany({
        where: {
          propertyId,
          status: { in: ['CONFIRMED', 'IN_PROGRESS'] },
          OR: [
            {
              AND: [
                { checkIn: { lte: endDate } },
                { checkOut: { gt: startDate } }
              ]
            }
          ]
        },
        select: {
          checkIn: true,
          checkOut: true,
          status: true
        }
      })

      // Create a map of dates with their status
      const availabilityMap = new Map()
      
      // Fill in all dates in the range
      const dates = this.generateDateRange(startDate, endDate)
      dates.forEach(date => {
        const dateStr = date.toISOString().split('T')[0]
        availabilityMap.set(dateStr, {
          date,
          available: true,
          price: property.basePrice,
          minStay: property.minStay,
          blocked: false,
          booked: false,
          notes: null
        })
      })

      // Apply availability rules
      availability.forEach(avail => {
        const dateStr = avail.date.toISOString().split('T')[0]
        if (availabilityMap.has(dateStr)) {
          const entry = availabilityMap.get(dateStr)
          entry.available = !avail.isBlocked
          entry.blocked = avail.isBlocked
          entry.price = avail.price || property.basePrice
          entry.minStay = avail.minStay || property.minStay
          entry.advanceNotice = avail.advanceNotice
          entry.notes = avail.notes
        }
      })

      // Mark booked dates as unavailable
      bookings.forEach(booking => {
        const bookingDates = this.generateDateRange(booking.checkIn, booking.checkOut)
        bookingDates.forEach(date => {
          const dateStr = date.toISOString().split('T')[0]
          if (availabilityMap.has(dateStr)) {
            const entry = availabilityMap.get(dateStr)
            entry.available = false
            entry.booked = true
          }
        })
      })

      const result = Array.from(availabilityMap.values())

      // Cache for 1 hour
      await cacheService.set(cacheKey, JSON.stringify(result), 3600)

      return result
    } catch (error) {
      console.error('Error getting availability:', error)
      return []
    }
  }

  // Bulk update availability
  async bulkUpdateAvailability(updates: AvailabilityUpdate[]): Promise<boolean> {
    try {
      // Group updates by property for cache invalidation
      const propertiesByUpdate = new Set(updates.map(u => u.propertyId))

      await Promise.all(updates.map(update =>
        prisma.propertyAvailability.upsert({
          where: {
            propertyId_date: {
              propertyId: update.propertyId,
              date: update.date
            }
          },
          update: {
            isBlocked: update.isBlocked,
            price: update.price,
            minStay: update.minStay,
            advanceNotice: update.advanceNotice,
            notes: update.notes,
            updatedAt: new Date()
          },
          create: {
            propertyId: update.propertyId,
            date: update.date,
            isBlocked: update.isBlocked,
            price: update.price,
            minStay: update.minStay,
            advanceNotice: update.advanceNotice,
            notes: update.notes
          }
        })
      ))

      // Invalidate cache for all affected properties
      await Promise.all(Array.from(propertiesByUpdate).map(propertyId =>
        this.invalidateAvailabilityCache(propertyId)
      ))

      return true
    } catch (error) {
      console.error('Error bulk updating availability:', error)
      return false
    }
  }

  // Generate iCal feed for external calendar sync
  async generateICalFeed(propertyId: string): Promise<string> {
    try {
      const property = await prisma.property.findUnique({
        where: { id: propertyId },
        select: { title: true, city: true, state: true }
      })

      if (!property) {
        throw new Error('Property not found')
      }

      // Get bookings for the next year
      const startDate = new Date()
      const endDate = new Date()
      endDate.setFullYear(startDate.getFullYear() + 1)

      const bookings = await prisma.booking.findMany({
        where: {
          propertyId,
          status: { in: ['CONFIRMED', 'IN_PROGRESS'] },
          checkOut: { gte: startDate },
          checkIn: { lte: endDate }
        },
        select: {
          id: true,
          checkIn: true,
          checkOut: true,
          guestName: true,
          status: true
        }
      })

      // Get blocked dates
      const blockedDates = await prisma.propertyAvailability.findMany({
        where: {
          propertyId,
          isBlocked: true,
          date: {
            gte: startDate,
            lte: endDate
          }
        }
      })

      // Create iCal calendar
      const calendar = ical({
        name: `${property.title} - HospedeFácil`,
        description: `Calendário de disponibilidade para ${property.title}`,
        timezone: 'America/Sao_Paulo',
        url: `https://hospedefacil.com.br/calendar/${propertyId}.ics`,
        ttl: 3600 // 1 hour cache
      })

      // Add booking events
      bookings.forEach(booking => {
        calendar.createEvent({
          id: booking.id,
          start: booking.checkIn,
          end: booking.checkOut,
          summary: `Reservado - ${booking.guestName}`,
          description: `Reserva confirmada para ${booking.guestName} (Status: ${booking.status})`,
          location: `${property.city}, ${property.state}`,
          status: booking.status === 'CONFIRMED' ? 'CONFIRMED' : 'TENTATIVE',
          busyStatus: 'BUSY'
        })
      })

      // Add blocked date events
      blockedDates.forEach(blocked => {
        calendar.createEvent({
          id: `blocked-${blocked.propertyId}-${blocked.date.toISOString()}`,
          start: blocked.date,
          end: new Date(blocked.date.getTime() + 24 * 60 * 60 * 1000),
          summary: 'Bloqueado',
          description: blocked.notes || 'Data bloqueada pelo anfitrião',
          location: `${property.city}, ${property.state}`,
          status: 'CONFIRMED',
          busyStatus: 'BUSY'
        })
      })

      return calendar.toString()
    } catch (error) {
      console.error('Error generating iCal feed:', error)
      throw error
    }
  }

  // Import external calendar (iCal)
  async importExternalCalendar(propertyId: string, icalUrl: string): Promise<boolean> {
    try {
      // Fetch iCal data
      const response = await axios.get(icalUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'HospedeFacil-Calendar/1.0'
        }
      })

      const icalData = response.data
      
      // Parse iCal data (simplified - would use a proper iCal parser in production)
      const events = this.parseICalEvents(icalData)
      
      // Convert events to availability blocks
      const updates: AvailabilityUpdate[] = []
      
      events.forEach(event => {
        if (event.start && event.end) {
          const dates = this.generateDateRange(event.start, event.end)
          dates.forEach(date => {
            updates.push({
              propertyId,
              date,
              isBlocked: true,
              notes: `Importado: ${event.summary || 'Evento externo'}`
            })
          })
        }
      })

      // Apply updates
      if (updates.length > 0) {
        await this.bulkUpdateAvailability(updates)
      }

      // Log sync
      await prisma.calendarSync.create({
        data: {
          propertyId,
          source: icalUrl,
          syncType: 'IMPORT',
          eventsImported: events.length,
          lastSyncAt: new Date()
        }
      })

      return true
    } catch (error) {
      console.error('Error importing external calendar:', error)
      return false
    }
  }

  // Setup automatic calendar synchronization
  async setupCalendarSync(config: CalendarSyncConfig): Promise<boolean> {
    try {
      await prisma.calendarSyncConfig.upsert({
        where: {
          propertyId_provider: {
            propertyId: config.propertyId,
            provider: config.provider
          }
        },
        update: {
          externalCalendarUrl: config.externalCalendarUrl,
          syncDirection: config.syncDirection,
          isActive: config.isActive,
          updatedAt: new Date()
        },
        create: {
          propertyId: config.propertyId,
          externalCalendarUrl: config.externalCalendarUrl,
          syncDirection: config.syncDirection,
          provider: config.provider,
          isActive: config.isActive
        }
      })

      return true
    } catch (error) {
      console.error('Error setting up calendar sync:', error)
      return false
    }
  }

  // Run automatic calendar synchronization
  async runCalendarSync(): Promise<void> {
    try {
      const syncConfigs = await prisma.calendarSyncConfig.findMany({
        where: { 
          isActive: true,
          OR: [
            { lastSyncAt: null },
            { lastSyncAt: { lt: new Date(Date.now() - 60 * 60 * 1000) } } // 1 hour ago
          ]
        }
      })

      for (const config of syncConfigs) {
        try {
          if (config.syncDirection === 'IMPORT' || config.syncDirection === 'BIDIRECTIONAL') {
            await this.importExternalCalendar(config.propertyId, config.externalCalendarUrl)
          }

          await prisma.calendarSyncConfig.update({
            where: { id: config.id },
            data: { lastSyncAt: new Date() }
          })
        } catch (error) {
          console.error(`Error syncing calendar for property ${config.propertyId}:`, error)
        }
      }
    } catch (error) {
      console.error('Error running calendar sync:', error)
    }
  }

  // Create availability template
  async createAvailabilityTemplate(name: string, rules: CalendarRule[]): Promise<string> {
    try {
      const template = await prisma.availabilityTemplate.create({
        data: {
          name,
          rules: JSON.stringify(rules),
          isActive: true
        }
      })

      return template.id
    } catch (error) {
      console.error('Error creating availability template:', error)
      throw error
    }
  }

  // Apply availability template to property
  async applyTemplate(propertyId: string, templateId: string): Promise<boolean> {
    try {
      const template = await prisma.availabilityTemplate.findUnique({
        where: { id: templateId }
      })

      if (!template) {
        throw new Error('Template not found')
      }

      const rules = JSON.parse(template.rules) as CalendarRule[]
      
      for (const rule of rules) {
        await this.applyCalendarRule(propertyId, rule)
      }

      return true
    } catch (error) {
      console.error('Error applying template:', error)
      return false
    }
  }

  // Private helper methods
  private generateDateRange(startDate: Date, endDate: Date): Date[] {
    const dates: Date[] = []
    const currentDate = new Date(startDate)
    
    while (currentDate <= endDate) {
      dates.push(new Date(currentDate))
      currentDate.setDate(currentDate.getDate() + 1)
    }
    
    return dates
  }

  private async applySingleRule(propertyId: string, rule: CalendarRule): Promise<boolean> {
    const dates = this.generateDateRange(rule.startDate, rule.endDate)
    const updates: AvailabilityUpdate[] = []

    dates.forEach(date => {
      const update: AvailabilityUpdate = {
        propertyId,
        date,
        isBlocked: false
      }

      switch (rule.type) {
        case 'BLOCK':
          update.isBlocked = true
          break
        case 'UNBLOCK':
          update.isBlocked = false
          break
        case 'PRICE':
          update.price = rule.value as number
          break
        case 'MIN_STAY':
          update.minStay = rule.value as number
          break
        case 'ADVANCE_NOTICE':
          update.advanceNotice = rule.value as number
          break
      }

      updates.push(update)
    })

    return await this.bulkUpdateAvailability(updates)
  }

  private async applyRecurringRule(propertyId: string, rule: CalendarRule): Promise<boolean> {
    if (!rule.recurring) return false

    const updates: AvailabilityUpdate[] = []
    let currentDate = new Date(rule.startDate)
    const endDate = rule.recurring.endDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // Default 1 year

    while (currentDate <= endDate) {
      let shouldApply = false

      switch (rule.recurring.frequency) {
        case 'DAILY':
          shouldApply = true
          break
        case 'WEEKLY':
          if (rule.recurring.daysOfWeek) {
            shouldApply = rule.recurring.daysOfWeek.includes(currentDate.getDay())
          }
          break
        case 'MONTHLY':
          shouldApply = currentDate.getDate() === rule.startDate.getDate()
          break
        case 'YEARLY':
          shouldApply = currentDate.getMonth() === rule.startDate.getMonth() && 
                       currentDate.getDate() === rule.startDate.getDate()
          break
      }

      if (shouldApply) {
        const update: AvailabilityUpdate = {
          propertyId,
          date: new Date(currentDate),
          isBlocked: rule.type === 'BLOCK'
        }

        if (rule.type === 'PRICE') {
          update.price = rule.value as number
        } else if (rule.type === 'MIN_STAY') {
          update.minStay = rule.value as number
        } else if (rule.type === 'ADVANCE_NOTICE') {
          update.advanceNotice = rule.value as number
        }

        updates.push(update)
      }

      // Increment date based on frequency
      switch (rule.recurring.frequency) {
        case 'DAILY':
          currentDate.setDate(currentDate.getDate() + (rule.recurring.interval || 1))
          break
        case 'WEEKLY':
          currentDate.setDate(currentDate.getDate() + 1)
          break
        case 'MONTHLY':
          currentDate.setMonth(currentDate.getMonth() + (rule.recurring.interval || 1))
          break
        case 'YEARLY':
          currentDate.setFullYear(currentDate.getFullYear() + (rule.recurring.interval || 1))
          break
      }
    }

    return await this.bulkUpdateAvailability(updates)
  }

  private async invalidateAvailabilityCache(propertyId: string): Promise<void> {
    try {
      const pattern = `availability:${propertyId}:*`
      await cacheService.invalidatePattern(pattern)
    } catch (error) {
      console.warn('Error invalidating availability cache:', error)
    }
  }

  private parseICalEvents(icalData: string): Array<{start: Date, end: Date, summary?: string}> {
    // Simplified iCal parsing - in production, use a proper library like 'node-ical'
    const events: Array<{start: Date, end: Date, summary?: string}> = []
    const lines = icalData.split('\n')
    let currentEvent: any = null

    for (const line of lines) {
      const trimmed = line.trim()
      
      if (trimmed === 'BEGIN:VEVENT') {
        currentEvent = {}
      } else if (trimmed === 'END:VEVENT' && currentEvent) {
        if (currentEvent.start && currentEvent.end) {
          events.push(currentEvent)
        }
        currentEvent = null
      } else if (currentEvent && trimmed.includes(':')) {
        const [key, ...valueParts] = trimmed.split(':')
        const value = valueParts.join(':')
        
        if (key.startsWith('DTSTART')) {
          currentEvent.start = this.parseICalDate(value)
        } else if (key.startsWith('DTEND')) {
          currentEvent.end = this.parseICalDate(value)
        } else if (key === 'SUMMARY') {
          currentEvent.summary = value
        }
      }
    }

    return events
  }

  private parseICalDate(dateStr: string): Date {
    // Parse iCal date format: YYYYMMDDTHHMMSS or YYYYMMDD
    if (dateStr.includes('T')) {
      const [datePart, timePart] = dateStr.split('T')
      return new Date(`${datePart.substring(0,4)}-${datePart.substring(4,6)}-${datePart.substring(6,8)}T${timePart.substring(0,2)}:${timePart.substring(2,4)}:${timePart.substring(4,6)}`)
    } else {
      return new Date(`${dateStr.substring(0,4)}-${dateStr.substring(4,6)}-${dateStr.substring(6,8)}`)
    }
  }
}
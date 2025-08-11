import { FastifyRequest } from 'fastify'
import { cacheService } from '@/config/redis.js'

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn', 
  INFO = 'info',
  DEBUG = 'debug'
}

export enum LogCategory {
  AUTH = 'auth',
  API = 'api',
  SECURITY = 'security',
  PAYMENT = 'payment',
  BOOKING = 'booking',
  SYSTEM = 'system',
  PERFORMANCE = 'performance'
}

interface LogEntry {
  timestamp: string
  level: LogLevel
  category: LogCategory
  message: string
  details?: any
  userId?: string
  ip?: string
  userAgent?: string
  requestId?: string
  duration?: number
  endpoint?: string
  method?: string
  statusCode?: number
}

export class Logger {
  private static instance: Logger
  private logBuffer: LogEntry[] = []
  private bufferSize = 1000
  private flushInterval = 30000 // 30 seconds

  constructor() {
    // Flush logs periodically
    setInterval(() => {
      this.flush()
    }, this.flushInterval)
    
    // Graceful shutdown
    process.on('SIGINT', () => this.flush())
    process.on('SIGTERM', () => this.flush())
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger()
    }
    return Logger.instance
  }

  log(level: LogLevel, category: LogCategory, message: string, details?: any, context?: {
    userId?: string
    ip?: string
    userAgent?: string
    requestId?: string
    duration?: number
    endpoint?: string
    method?: string
    statusCode?: number
  }) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      details,
      ...context
    }

    // Console log for development
    if (process.env.NODE_ENV === 'development') {
      const logMethod = level === LogLevel.ERROR ? console.error : 
                       level === LogLevel.WARN ? console.warn : console.log
      
      logMethod(`[${entry.timestamp}] [${level.toUpperCase()}] [${category.toUpperCase()}] ${message}`, 
                details ? details : '')
    }

    // Add to buffer
    this.logBuffer.push(entry)

    // Auto-flush if buffer is full
    if (this.logBuffer.length >= this.bufferSize) {
      this.flush()
    }

    // Critical errors should be flushed immediately
    if (level === LogLevel.ERROR) {
      this.flush()
    }
  }

  error(category: LogCategory, message: string, error?: Error | any, context?: any) {
    const details = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...context
    } : error

    this.log(LogLevel.ERROR, category, message, details, context)
  }

  warn(category: LogCategory, message: string, details?: any, context?: any) {
    this.log(LogLevel.WARN, category, message, details, context)
  }

  info(category: LogCategory, message: string, details?: any, context?: any) {
    this.log(LogLevel.INFO, category, message, details, context)
  }

  debug(category: LogCategory, message: string, details?: any, context?: any) {
    if (process.env.NODE_ENV === 'development') {
      this.log(LogLevel.DEBUG, category, message, details, context)
    }
  }

  // Request-specific logging helpers
  logRequest(request: FastifyRequest, statusCode?: number, duration?: number) {
    const context = {
      userId: request.user?.id,
      ip: this.getClientIP(request),
      userAgent: request.headers['user-agent'],
      requestId: request.id,
      endpoint: request.url,
      method: request.method,
      statusCode,
      duration
    }

    const level = statusCode && statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO
    const message = `${request.method} ${request.url} - ${statusCode || 'processing'}`

    this.log(level, LogCategory.API, message, null, context)
  }

  logAuth(action: string, success: boolean, userId?: string, request?: FastifyRequest, details?: any) {
    const context = request ? {
      userId,
      ip: this.getClientIP(request),
      userAgent: request.headers['user-agent'],
      requestId: request.id
    } : { userId }

    const level = success ? LogLevel.INFO : LogLevel.WARN
    const message = `Auth ${action}: ${success ? 'success' : 'failed'}`

    this.log(level, LogCategory.AUTH, message, details, context)
  }

  logSecurity(threat: string, severity: 'low' | 'medium' | 'high', request: FastifyRequest, details?: any) {
    const context = {
      userId: request.user?.id,
      ip: this.getClientIP(request),
      userAgent: request.headers['user-agent'],
      requestId: request.id,
      endpoint: request.url,
      method: request.method
    }

    const level = severity === 'high' ? LogLevel.ERROR : 
                  severity === 'medium' ? LogLevel.WARN : LogLevel.INFO
    const message = `Security threat detected: ${threat}`

    this.log(level, LogCategory.SECURITY, message, details, context)
  }

  logPayment(action: string, success: boolean, amount?: number, paymentId?: string, userId?: string, details?: any) {
    const level = success ? LogLevel.INFO : LogLevel.ERROR
    const message = `Payment ${action}: ${success ? 'success' : 'failed'}`

    this.log(level, LogCategory.PAYMENT, message, {
      amount,
      paymentId,
      ...details
    }, { userId })
  }

  logBooking(action: string, bookingId: string, userId?: string, propertyId?: string, details?: any) {
    const message = `Booking ${action}: ${bookingId}`

    this.log(LogLevel.INFO, LogCategory.BOOKING, message, {
      bookingId,
      propertyId,
      ...details
    }, { userId })
  }

  logPerformance(operation: string, duration: number, details?: any) {
    const level = duration > 5000 ? LogLevel.WARN : LogLevel.INFO // Warn if > 5 seconds
    const message = `Performance: ${operation} took ${duration}ms`

    this.log(level, LogCategory.PERFORMANCE, message, details)
  }

  private async flush() {
    if (this.logBuffer.length === 0) return

    const logs = [...this.logBuffer]
    this.logBuffer = []

    try {
      // Store in Redis for temporary access
      await cacheService.set(
        `logs:${Date.now()}`,
        JSON.stringify(logs),
        3600 // 1 hour TTL
      )

      // In production, you would send to your logging service
      // Examples: Elasticsearch, CloudWatch, Splunk, Datadog, etc.
      if (process.env.NODE_ENV === 'production') {
        await this.sendToLoggingService(logs)
      }

    } catch (error) {
      console.error('Failed to flush logs:', error)
      // Restore logs to buffer if flush failed
      this.logBuffer.unshift(...logs)
    }
  }

  private async sendToLoggingService(logs: LogEntry[]) {
    // Implement your logging service integration here
    // Examples:
    
    // AWS CloudWatch Logs
    // await cloudWatchLogs.putLogEvents({ ... })
    
    // Elasticsearch
    // await elasticsearch.bulk({ body: logs })
    
    // External service via HTTP
    // await axios.post('https://logging-service.com/api/logs', logs)
    
    // For now, we'll just log critical errors
    const criticalLogs = logs.filter(log => 
      log.level === LogLevel.ERROR || 
      (log.category === LogCategory.SECURITY && log.level === LogLevel.WARN)
    )
    
    if (criticalLogs.length > 0) {
      console.error('CRITICAL LOGS:', JSON.stringify(criticalLogs, null, 2))
    }
  }

  private getClientIP(request: FastifyRequest): string {
    const forwarded = request.headers['x-forwarded-for'] as string
    const realIP = request.headers['x-real-ip'] as string
    
    if (forwarded) {
      return forwarded.split(',')[0].trim()
    }
    
    if (realIP) {
      return realIP
    }
    
    return request.ip || 'unknown'
  }

  // Get recent logs from cache
  async getRecentLogs(category?: LogCategory, level?: LogLevel, limit: number = 100): Promise<LogEntry[]> {
    try {
      const keys = await cacheService.getKeys('logs:*')
      const allLogs: LogEntry[] = []

      for (const key of keys) {
        const logsData = await cacheService.get(key)
        if (logsData) {
          const logs = JSON.parse(logsData) as LogEntry[]
          allLogs.push(...logs)
        }
      }

      // Filter logs
      let filteredLogs = allLogs
      if (category) {
        filteredLogs = filteredLogs.filter(log => log.category === category)
      }
      if (level) {
        filteredLogs = filteredLogs.filter(log => log.level === level)
      }

      // Sort by timestamp (newest first) and limit
      return filteredLogs
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit)

    } catch (error) {
      console.error('Failed to get recent logs:', error)
      return []
    }
  }

  // Get log statistics
  async getLogStats(hours: number = 24): Promise<{
    totalLogs: number
    byLevel: Record<LogLevel, number>
    byCategory: Record<LogCategory, number>
    errorRate: number
  }> {
    try {
      const logs = await this.getRecentLogs(undefined, undefined, 10000)
      const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000)
      
      const recentLogs = logs.filter(log => new Date(log.timestamp) >= cutoff)
      
      const stats = {
        totalLogs: recentLogs.length,
        byLevel: {} as Record<LogLevel, number>,
        byCategory: {} as Record<LogCategory, number>,
        errorRate: 0
      }

      // Initialize counters
      Object.values(LogLevel).forEach(level => {
        stats.byLevel[level] = 0
      })
      Object.values(LogCategory).forEach(category => {
        stats.byCategory[category] = 0
      })

      // Count logs
      recentLogs.forEach(log => {
        stats.byLevel[log.level]++
        stats.byCategory[log.category]++
      })

      // Calculate error rate
      const errorCount = stats.byLevel[LogLevel.ERROR]
      stats.errorRate = stats.totalLogs > 0 ? (errorCount / stats.totalLogs) * 100 : 0

      return stats

    } catch (error) {
      console.error('Failed to get log stats:', error)
      return {
        totalLogs: 0,
        byLevel: {} as Record<LogLevel, number>,
        byCategory: {} as Record<LogCategory, number>,
        errorRate: 0
      }
    }
  }
}

// Export singleton instance
export const logger = Logger.getInstance()
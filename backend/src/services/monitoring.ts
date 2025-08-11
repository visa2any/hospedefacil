import { FastifyRequest } from 'fastify'
import { prisma } from '@/config/database.js'
import { cacheService } from '@/config/redis.js'

export class MonitoringService {

  // Track system metrics
  async trackSystemMetrics(): Promise<SystemMetrics> {
    const metrics = {
      timestamp: new Date().toISOString(),
      database: await this.getDatabaseMetrics(),
      cache: await this.getCacheMetrics(),
      api: await this.getAPIMetrics(),
      business: await this.getBusinessMetrics(),
      errors: await this.getErrorMetrics()
    }

    // Store metrics for historical analysis
    await this.storeMetrics(metrics)

    return metrics
  }

  // Track user activity
  async trackUserActivity(
    userId: string,
    activity: string,
    metadata?: Record<string, any>,
    request?: FastifyRequest
  ): Promise<void> {
    try {
      const activityData = {
        userId,
        activity,
        metadata: metadata || {},
        timestamp: new Date().toISOString(),
        userAgent: request?.headers['user-agent'],
        ip: this.getClientIP(request),
        sessionId: this.extractSessionId(request)
      }

      // Store in analytics table
      await prisma.analytics.create({
        data: {
          event: activity,
          userId,
          sessionId: activityData.sessionId,
          data: activityData
        }
      })

      // Track real-time metrics
      await this.updateRealTimeMetrics(activity, activityData)

    } catch (error) {
      console.error('Failed to track user activity:', error)
    }
  }

  // Track business events
  async trackBusinessEvent(
    event: string,
    data: Record<string, any>,
    userId?: string
  ): Promise<void> {
    try {
      await prisma.analytics.create({
        data: {
          event,
          userId,
          data: {
            ...data,
            timestamp: new Date().toISOString()
          }
        }
      })

      // Update business metrics cache
      await this.updateBusinessMetricsCache(event, data)

    } catch (error) {
      console.error('Failed to track business event:', error)
    }
  }

  // Get real-time system health
  async getSystemHealth(): Promise<SystemHealth> {
    const health: SystemHealth = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: await this.checkDatabaseHealth(),
        cache: await this.checkCacheHealth(),
        api: await this.checkAPIHealth(),
        external: await this.checkExternalServicesHealth()
      },
      performance: await this.getPerformanceMetrics(),
      alerts: await this.getActiveAlerts()
    }

    // Determine overall status
    const serviceStatuses = Object.values(health.services)
    if (serviceStatuses.some(s => s.status === 'down')) {
      health.status = 'critical'
    } else if (serviceStatuses.some(s => s.status === 'degraded')) {
      health.status = 'warning'
    }

    return health
  }

  // Performance monitoring
  async trackAPIPerformance(
    endpoint: string,
    method: string,
    statusCode: number,
    responseTime: number,
    userId?: string
  ): Promise<void> {
    const key = `api_perf:${endpoint}:${method}`
    
    try {
      // Store in time-series format
      const timestamp = Date.now()
      await cacheService.zadd(
        `${key}:response_times`, 
        timestamp, 
        `${responseTime}:${statusCode}:${userId || 'anonymous'}`
      )

      // Keep only last 24 hours
      await cacheService.zremrangebyscore(
        `${key}:response_times`,
        0,
        timestamp - (24 * 60 * 60 * 1000)
      )

      // Update counters
      await Promise.all([
        cacheService.hincrby('api_calls_total', key, 1),
        cacheService.hincrby('api_calls_by_status', `${key}:${statusCode}`, 1),
        this.updateLatencyMetrics(key, responseTime)
      ])

    } catch (error) {
      console.error('Failed to track API performance:', error)
    }
  }

  // Error tracking and alerting
  async trackError(
    error: Error,
    context: {
      userId?: string
      endpoint?: string
      method?: string
      requestId?: string
      metadata?: Record<string, any>
    }
  ): Promise<void> {
    try {
      const errorData = {
        message: error.message,
        stack: error.stack,
        name: error.name,
        context,
        timestamp: new Date().toISOString(),
        fingerprint: this.generateErrorFingerprint(error, context)
      }

      // Store error
      await prisma.analytics.create({
        data: {
          event: 'error',
          userId: context.userId,
          data: errorData
        }
      })

      // Update error rate metrics
      await this.updateErrorRateMetrics(context.endpoint || 'unknown')

      // Check if we need to trigger alerts
      await this.checkErrorAlerts(errorData)

    } catch (trackingError) {
      console.error('Failed to track error:', trackingError)
    }
  }

  // Generate system reports
  async generateSystemReport(period: 'hour' | 'day' | 'week' | 'month'): Promise<SystemReport> {
    const endTime = new Date()
    const startTime = this.getPeriodStartTime(period, endTime)

    const [
      apiMetrics,
      userMetrics,
      businessMetrics,
      errorMetrics,
      performanceMetrics
    ] = await Promise.all([
      this.getAPIsMetricsForPeriod(startTime, endTime),
      this.getUserMetricsForPeriod(startTime, endTime),
      this.getBusinessMetricsForPeriod(startTime, endTime),
      this.getErrorMetricsForPeriod(startTime, endTime),
      this.getPerformanceMetricsForPeriod(startTime, endTime)
    ])

    return {
      period,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      api: apiMetrics,
      users: userMetrics,
      business: businessMetrics,
      errors: errorMetrics,
      performance: performanceMetrics,
      recommendations: await this.generateRecommendations(startTime, endTime)
    }
  }

  // Alert management
  async checkAndTriggerAlerts(): Promise<void> {
    const alerts = await this.evaluateAlertRules()
    
    for (const alert of alerts) {
      if (alert.shouldTrigger) {
        await this.triggerAlert(alert)
      }
    }
  }

  // Private helper methods
  private async getDatabaseMetrics(): Promise<DatabaseMetrics> {
    try {
      const startTime = Date.now()
      await prisma.$queryRaw`SELECT 1`
      const responseTime = Date.now() - startTime

      const [userCount, propertyCount, bookingCount] = await Promise.all([
        prisma.user.count(),
        prisma.property.count(),
        prisma.booking.count({ where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } })
      ])

      return {
        status: 'healthy',
        responseTime,
        connectionPool: {
          active: 10, // Would get from actual pool
          idle: 5,
          total: 15
        },
        counts: {
          users: userCount,
          properties: propertyCount,
          dailyBookings: bookingCount
        }
      }
    } catch (error) {
      return {
        status: 'down',
        responseTime: 0,
        error: error.message,
        connectionPool: { active: 0, idle: 0, total: 0 },
        counts: { users: 0, properties: 0, dailyBookings: 0 }
      }
    }
  }

  private async getCacheMetrics(): Promise<CacheMetrics> {
    try {
      const startTime = Date.now()
      await cacheService.ping()
      const responseTime = Date.now() - startTime

      const info = await cacheService.info()
      const memory = await cacheService.memory('usage')

      return {
        status: 'healthy',
        responseTime,
        memoryUsage: parseInt(memory || '0'),
        hitRate: this.calculateCacheHitRate(info),
        keyCount: await cacheService.dbsize()
      }
    } catch (error) {
      return {
        status: 'down',
        responseTime: 0,
        error: error.message,
        memoryUsage: 0,
        hitRate: 0,
        keyCount: 0
      }
    }
  }

  private async getAPIMetrics(): Promise<APIMetrics> {
    const totalCalls = await cacheService.hgetall('api_calls_total')
    const errorCalls = await cacheService.hgetall('api_calls_by_status')
    
    const total = Object.values(totalCalls).reduce((sum, val) => sum + parseInt(val), 0)
    const errors = Object.entries(errorCalls)
      .filter(([key]) => key.includes(':5') || key.includes(':4'))
      .reduce((sum, [, val]) => sum + parseInt(val), 0)

    return {
      totalRequests: total,
      errorRate: total > 0 ? errors / total : 0,
      averageResponseTime: await this.calculateAverageResponseTime(),
      topEndpoints: await this.getTopEndpoints()
    }
  }

  private async getBusinessMetrics(): Promise<BusinessMetrics> {
    const today = new Date()
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)

    const [todayBookings, todayRevenue, activeUsers, newUsers] = await Promise.all([
      prisma.booking.count({
        where: { createdAt: { gte: yesterday } }
      }),
      prisma.payment.aggregate({
        where: {
          createdAt: { gte: yesterday },
          status: 'COMPLETED'
        },
        _sum: { amount: true }
      }),
      this.getActiveUsersCount(),
      prisma.user.count({
        where: { createdAt: { gte: yesterday } }
      })
    ])

    return {
      dailyBookings: todayBookings,
      dailyRevenue: todayRevenue._sum.amount || 0,
      activeUsers,
      newUsers,
      conversionRate: await this.calculateConversionRate()
    }
  }

  private async getErrorMetrics(): Promise<ErrorMetrics> {
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000)
    
    const errors = await prisma.analytics.findMany({
      where: {
        event: 'error',
        createdAt: { gte: last24Hours }
      },
      select: { data: true }
    })

    const errorsByType: Record<string, number> = {}
    errors.forEach(error => {
      const errorData = error.data as any
      const type = errorData.name || 'Unknown'
      errorsByType[type] = (errorsByType[type] || 0) + 1
    })

    return {
      totalErrors: errors.length,
      errorRate: await this.calculateErrorRate(),
      errorsByType,
      criticalErrors: errors.filter(e => (e.data as any).context?.statusCode >= 500).length
    }
  }

  private async checkDatabaseHealth(): Promise<ServiceHealth> {
    try {
      const startTime = Date.now()
      await prisma.$queryRaw`SELECT 1`
      const responseTime = Date.now() - startTime

      return {
        status: responseTime < 100 ? 'healthy' : responseTime < 500 ? 'degraded' : 'down',
        responseTime,
        lastCheck: new Date().toISOString()
      }
    } catch (error) {
      return {
        status: 'down',
        responseTime: 0,
        error: error.message,
        lastCheck: new Date().toISOString()
      }
    }
  }

  private async checkCacheHealth(): Promise<ServiceHealth> {
    try {
      const startTime = Date.now()
      await cacheService.ping()
      const responseTime = Date.now() - startTime

      return {
        status: responseTime < 50 ? 'healthy' : responseTime < 200 ? 'degraded' : 'down',
        responseTime,
        lastCheck: new Date().toISOString()
      }
    } catch (error) {
      return {
        status: 'down',
        responseTime: 0,
        error: error.message,
        lastCheck: new Date().toISOString()
      }
    }
  }

  private async checkAPIHealth(): Promise<ServiceHealth> {
    const errorRate = await this.calculateErrorRate()
    const avgResponseTime = await this.calculateAverageResponseTime()

    return {
      status: errorRate < 0.01 && avgResponseTime < 500 ? 'healthy' : 
              errorRate < 0.05 && avgResponseTime < 1000 ? 'degraded' : 'down',
      responseTime: avgResponseTime,
      metadata: { errorRate },
      lastCheck: new Date().toISOString()
    }
  }

  private async checkExternalServicesHealth(): Promise<ServiceHealth> {
    // Check external services like Mercado Pago, WhatsApp API, etc.
    // This is a simplified version
    try {
      // You would implement actual health checks for external services here
      return {
        status: 'healthy',
        responseTime: 200,
        lastCheck: new Date().toISOString()
      }
    } catch (error) {
      return {
        status: 'down',
        responseTime: 0,
        error: error.message,
        lastCheck: new Date().toISOString()
      }
    }
  }

  private async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    return {
      averageResponseTime: await this.calculateAverageResponseTime(),
      p95ResponseTime: await this.calculateP95ResponseTime(),
      throughput: await this.calculateThroughput(),
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
      cpuUsage: await this.getCPUUsage()
    }
  }

  private async getActiveAlerts(): Promise<Alert[]> {
    // Implementation would check for active alerts
    return []
  }

  private getClientIP(request?: FastifyRequest): string | undefined {
    if (!request) return undefined
    
    return request.headers['x-forwarded-for'] as string ||
           request.headers['x-real-ip'] as string ||
           request.socket.remoteAddress
  }

  private extractSessionId(request?: FastifyRequest): string | undefined {
    if (!request) return undefined
    
    // Extract from cookie or header
    return request.headers['x-session-id'] as string ||
           request.cookies?.sessionId
  }

  private async updateRealTimeMetrics(activity: string, data: any): Promise<void> {
    const key = `realtime:${activity}`
    const timestamp = Math.floor(Date.now() / 1000)
    
    // Update counters
    await cacheService.hincrby('realtime_activities', activity, 1)
    
    // Update time series (keep last hour)
    await cacheService.zadd(key, timestamp, JSON.stringify(data))
    await cacheService.zremrangebyscore(key, 0, timestamp - 3600)
  }

  private async updateBusinessMetricsCache(event: string, data: Record<string, any>): Promise<void> {
    const today = new Date().toISOString().split('T')[0]
    
    if (event === 'booking_created') {
      await cacheService.hincrby(`business_metrics:${today}`, 'bookings', 1)
    } else if (event === 'payment_completed') {
      await cacheService.hincrby(`business_metrics:${today}`, 'revenue', data.amount || 0)
    } else if (event === 'user_registered') {
      await cacheService.hincrby(`business_metrics:${today}`, 'new_users', 1)
    }
  }

  private async updateLatencyMetrics(key: string, responseTime: number): Promise<void> {
    // Update rolling average
    await cacheService.zadd(`${key}:latency`, Date.now(), responseTime.toString())
    
    // Keep only last hour of latency data
    const oneHourAgo = Date.now() - (60 * 60 * 1000)
    await cacheService.zremrangebyscore(`${key}:latency`, 0, oneHourAgo)
  }

  private async updateErrorRateMetrics(endpoint: string): Promise<void> {
    const key = `error_rate:${endpoint}`
    const timestamp = Math.floor(Date.now() / 60) // Per minute buckets
    
    await cacheService.hincrby(key, timestamp.toString(), 1)
    
    // Clean old data (keep last 24 hours)
    const oneDayAgo = timestamp - (24 * 60)
    const fields = await cacheService.hkeys(key)
    const oldFields = fields.filter(field => parseInt(field) < oneDayAgo)
    
    if (oldFields.length > 0) {
      await cacheService.hdel(key, ...oldFields)
    }
  }

  private generateErrorFingerprint(error: Error, context: any): string {
    const fingerprint = `${error.name}:${context.endpoint}:${error.message.substring(0, 100)}`
    return require('crypto').createHash('md5').update(fingerprint).digest('hex')
  }

  private async checkErrorAlerts(errorData: any): Promise<void> {
    const recentErrors = await this.getRecentErrorCount(errorData.fingerprint)
    
    if (recentErrors > 10) {
      await this.triggerAlert({
        type: 'error_spike',
        severity: 'high',
        message: `Error spike detected: ${errorData.message}`,
        data: errorData
      })
    }
  }

  private async getRecentErrorCount(fingerprint: string): Promise<number> {
    const key = `error_count:${fingerprint}`
    const count = await cacheService.get(key)
    
    if (!count) {
      await cacheService.setex(key, 3600, '1') // 1 hour TTL
      return 1
    }
    
    const newCount = parseInt(count) + 1
    await cacheService.setex(key, 3600, newCount.toString())
    return newCount
  }

  private async storeMetrics(metrics: SystemMetrics): Promise<void> {
    try {
      await prisma.analytics.create({
        data: {
          event: 'system_metrics',
          data: metrics
        }
      })
    } catch (error) {
      console.error('Failed to store metrics:', error)
    }
  }

  private getPeriodStartTime(period: string, endTime: Date): Date {
    const startTime = new Date(endTime)
    
    switch (period) {
      case 'hour':
        startTime.setHours(endTime.getHours() - 1)
        break
      case 'day':
        startTime.setDate(endTime.getDate() - 1)
        break
      case 'week':
        startTime.setDate(endTime.getDate() - 7)
        break
      case 'month':
        startTime.setMonth(endTime.getMonth() - 1)
        break
    }
    
    return startTime
  }

  private async evaluateAlertRules(): Promise<AlertRule[]> {
    // Implementation would evaluate various alert rules
    // This is a simplified version
    return []
  }

  private async triggerAlert(alert: any): Promise<void> {
    console.log('ALERT:', alert)
    
    // Here you would integrate with alerting services like:
    // - Email notifications
    // - Slack/Teams webhooks
    // - SMS alerts
    // - PagerDuty integration
    
    // Store alert in database
    await prisma.analytics.create({
      data: {
        event: 'alert_triggered',
        data: alert
      }
    })
  }

  // Additional helper methods would be implemented here...
  private calculateCacheHitRate(info: string): number {
    // Parse Redis INFO output to calculate hit rate
    return 0.95 // Placeholder
  }

  private async calculateAverageResponseTime(): Promise<number> {
    // Calculate from stored metrics
    return 250 // Placeholder
  }

  private async getTopEndpoints(): Promise<Array<{endpoint: string, calls: number}>> {
    const calls = await cacheService.hgetall('api_calls_total')
    return Object.entries(calls)
      .map(([endpoint, calls]) => ({ endpoint, calls: parseInt(calls) }))
      .sort((a, b) => b.calls - a.calls)
      .slice(0, 10)
  }

  private async getActiveUsersCount(): Promise<number> {
    // Count users active in last 24 hours
    return await prisma.user.count({
      where: {
        lastLoginAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }
    })
  }

  private async calculateConversionRate(): Promise<number> {
    // Calculate booking conversion rate
    const [visitors, bookings] = await Promise.all([
      prisma.analytics.count({
        where: {
          event: 'property_view',
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }
      }),
      prisma.booking.count({
        where: {
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }
      })
    ])

    return visitors > 0 ? bookings / visitors : 0
  }

  private async calculateErrorRate(): Promise<number> {
    // Implementation would calculate actual error rate
    return 0.001 // Placeholder: 0.1%
  }

  private async calculateP95ResponseTime(): Promise<number> {
    // Calculate 95th percentile response time
    return 500 // Placeholder
  }

  private async calculateThroughput(): Promise<number> {
    // Calculate requests per second
    return 10.5 // Placeholder
  }

  private async getCPUUsage(): Promise<number> {
    // Get CPU usage percentage
    return 25.5 // Placeholder
  }

  private async getAPIsMetricsForPeriod(start: Date, end: Date): Promise<any> {
    // Implementation for API metrics in period
    return {}
  }

  private async getUserMetricsForPeriod(start: Date, end: Date): Promise<any> {
    // Implementation for user metrics in period
    return {}
  }

  private async getBusinessMetricsForPeriod(start: Date, end: Date): Promise<any> {
    // Implementation for business metrics in period
    return {}
  }

  private async getErrorMetricsForPeriod(start: Date, end: Date): Promise<any> {
    // Implementation for error metrics in period
    return {}
  }

  private async getPerformanceMetricsForPeriod(start: Date, end: Date): Promise<any> {
    // Implementation for performance metrics in period
    return {}
  }

  private async generateRecommendations(start: Date, end: Date): Promise<string[]> {
    // Generate system recommendations based on metrics
    return [
      'Sistema operando normalmente',
      'Monitore picos de tráfego nos horários de pico',
      'Considere otimizar queries mais lentas'
    ]
  }
}

// Type definitions
interface SystemMetrics {
  timestamp: string
  database: DatabaseMetrics
  cache: CacheMetrics
  api: APIMetrics
  business: BusinessMetrics
  errors: ErrorMetrics
}

interface DatabaseMetrics {
  status: string
  responseTime: number
  error?: string
  connectionPool: {
    active: number
    idle: number
    total: number
  }
  counts: {
    users: number
    properties: number
    dailyBookings: number
  }
}

interface CacheMetrics {
  status: string
  responseTime: number
  error?: string
  memoryUsage: number
  hitRate: number
  keyCount: number
}

interface APIMetrics {
  totalRequests: number
  errorRate: number
  averageResponseTime: number
  topEndpoints: Array<{endpoint: string, calls: number}>
}

interface BusinessMetrics {
  dailyBookings: number
  dailyRevenue: number
  activeUsers: number
  newUsers: number
  conversionRate: number
}

interface ErrorMetrics {
  totalErrors: number
  errorRate: number
  errorsByType: Record<string, number>
  criticalErrors: number
}

interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical'
  timestamp: string
  services: {
    database: ServiceHealth
    cache: ServiceHealth
    api: ServiceHealth
    external: ServiceHealth
  }
  performance: PerformanceMetrics
  alerts: Alert[]
}

interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'down'
  responseTime: number
  error?: string
  metadata?: Record<string, any>
  lastCheck: string
}

interface PerformanceMetrics {
  averageResponseTime: number
  p95ResponseTime: number
  throughput: number
  memoryUsage: number
  cpuUsage: number
}

interface Alert {
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  timestamp?: string
  data?: any
}

interface AlertRule {
  type: string
  shouldTrigger: boolean
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  data?: any
}

interface SystemReport {
  period: string
  startTime: string
  endTime: string
  api: any
  users: any
  business: any
  errors: any
  performance: any
  recommendations: string[]
}

export default new MonitoringService()
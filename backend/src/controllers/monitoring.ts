import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { logger, LogLevel, LogCategory } from '@/services/monitoring/logger.js'
import { healthChecker } from '@/services/monitoring/healthCheck.js'
import { prisma } from '@/config/database.js'
import { cacheService } from '@/config/redis.js'

// Validation schemas
const logQuerySchema = z.object({
  category: z.nativeEnum(LogCategory).optional(),
  level: z.nativeEnum(LogLevel).optional(),
  limit: z.number().int().min(1).max(1000).default(100),
  hours: z.number().int().min(1).max(168).default(24) // Max 1 week
})

const alertQuerySchema = z.object({
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  active: z.boolean().optional(),
  limit: z.number().int().min(1).max(100).default(50)
})

export class MonitoringController {
  
  // Get system health status
  async getHealth(request: FastifyRequest, reply: FastifyReply) {
    try {
      const health = await healthChecker.getHealthStatus()
      return reply.send(health)
    } catch (error) {
      logger.error(LogCategory.SYSTEM, 'Health check endpoint failed', error)
      return reply.status(500).send({
        error: 'Health check failed',
        message: 'Não foi possível verificar a saúde do sistema.'
      })
    }
  }

  // Get application metrics
  async getMetrics(request: FastifyRequest, reply: FastifyReply) {
    try {
      const [logStats, systemHealth, dbMetrics, cacheMetrics] = await Promise.all([
        logger.getLogStats(24),
        healthChecker.getHealthStatus(),
        this.getDatabaseMetrics(),
        this.getCacheMetrics()
      ])

      const metrics = {
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        system: {
          status: systemHealth.status,
          memory: systemHealth.metrics.performance.memoryUsage,
          cpu: systemHealth.metrics.performance.cpuUsage
        },
        application: {
          requests: systemHealth.metrics.requests,
          logs: logStats,
          errorRate: logStats.errorRate
        },
        services: {
          database: dbMetrics,
          cache: cacheMetrics
        }
      }

      return reply.send(metrics)
    } catch (error) {
      logger.error(LogCategory.SYSTEM, 'Metrics endpoint failed', error)
      return reply.status(500).send({
        error: 'Metrics unavailable',
        message: 'Não foi possível obter as métricas do sistema.'
      })
    }
  }

  // Get system logs
  async getLogs(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = logQuerySchema.parse(request.query)
      
      const logs = await logger.getRecentLogs(
        query.category,
        query.level,
        query.limit
      )

      return reply.send({
        logs,
        filters: {
          category: query.category,
          level: query.level,
          hours: query.hours
        },
        total: logs.length
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Parâmetros inválidos',
          details: error.errors
        })
      }

      logger.error(LogCategory.SYSTEM, 'Logs endpoint failed', error)
      return reply.status(500).send({
        error: 'Logs unavailable',
        message: 'Não foi possível obter os logs do sistema.'
      })
    }
  }

  // Get log statistics
  async getLogStats(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { hours = 24 } = request.query as { hours?: number }
      
      const stats = await logger.getLogStats(hours)
      
      return reply.send({
        period: `${hours} hours`,
        ...stats
      })
    } catch (error) {
      logger.error(LogCategory.SYSTEM, 'Log stats endpoint failed', error)
      return reply.status(500).send({
        error: 'Stats unavailable',
        message: 'Não foi possível obter as estatísticas de logs.'
      })
    }
  }

  // Get security alerts
  async getSecurityAlerts(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = alertQuerySchema.parse(request.query)
      
      // Get security-related logs
      const securityLogs = await logger.getRecentLogs(
        LogCategory.SECURITY,
        undefined,
        query.limit
      )

      // Filter by severity if specified
      let alerts = securityLogs
      if (query.severity) {
        alerts = securityLogs.filter(log => {
          const severity = this.getLogSeverity(log.level)
          return severity === query.severity
        })
      }

      // Get alert summary
      const alertSummary = this.getAlertSummary(alerts)

      return reply.send({
        alerts,
        summary: alertSummary,
        filters: query
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Parâmetros inválidos',
          details: error.errors
        })
      }

      logger.error(LogCategory.SYSTEM, 'Security alerts endpoint failed', error)
      return reply.status(500).send({
        error: 'Alerts unavailable',
        message: 'Não foi possível obter os alertas de segurança.'
      })
    }
  }

  // Get performance metrics
  async getPerformanceMetrics(request: FastifyRequest, reply: FastifyReply) {
    try {
      const [slowQueries, highMemoryUsage, errorRates] = await Promise.all([
        this.getSlowQueries(),
        this.getHighMemoryUsageAlerts(),
        this.getErrorRateMetrics()
      ])

      const performance = {
        timestamp: new Date().toISOString(),
        slowQueries,
        memoryAlerts: highMemoryUsage,
        errorRates,
        recommendations: this.generatePerformanceRecommendations({
          slowQueries,
          highMemoryUsage,
          errorRates
        })
      }

      return reply.send(performance)
    } catch (error) {
      logger.error(LogCategory.PERFORMANCE, 'Performance metrics endpoint failed', error)
      return reply.status(500).send({
        error: 'Performance metrics unavailable',
        message: 'Não foi possível obter as métricas de performance.'
      })
    }
  }

  // Get audit trail
  async getAuditTrail(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { 
        startDate,
        endDate,
        userId,
        action,
        limit = 100 
      } = request.query as {
        startDate?: string
        endDate?: string
        userId?: string
        action?: string
        limit?: number
      }

      // Get audit logs (would be from a dedicated audit table in production)
      const auditLogs = await logger.getRecentLogs(LogCategory.AUTH, undefined, limit)
      
      return reply.send({
        auditTrail: auditLogs,
        filters: {
          startDate,
          endDate,
          userId,
          action
        },
        total: auditLogs.length
      })
    } catch (error) {
      logger.error(LogCategory.SYSTEM, 'Audit trail endpoint failed', error)
      return reply.status(500).send({
        error: 'Audit trail unavailable',
        message: 'Não foi possível obter o rastro de auditoria.'
      })
    }
  }

  // Test alert system
  async testAlert(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { type = 'test', severity = 'low' } = request.body as {
        type?: string
        severity?: 'low' | 'medium' | 'high'
      }

      // Generate test alert
      logger.logSecurity(
        `Test alert: ${type}`,
        severity,
        request,
        {
          testAlert: true,
          generatedBy: request.user?.id || 'unknown',
          timestamp: new Date().toISOString()
        }
      )

      return reply.send({
        message: 'Alerta de teste gerado com sucesso',
        type,
        severity,
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      logger.error(LogCategory.SYSTEM, 'Test alert failed', error)
      return reply.status(500).send({
        error: 'Test alert failed',
        message: 'Não foi possível gerar o alerta de teste.'
      })
    }
  }

  // Private helper methods

  private async getDatabaseMetrics() {
    try {
      // Get basic database metrics
      const [userCount, propertyCount, bookingCount] = await Promise.all([
        prisma.user.count(),
        prisma.property.count(),
        prisma.booking.count()
      ])

      return {
        status: 'healthy',
        connections: 'N/A', // Would implement actual connection pool metrics
        totalUsers: userCount,
        totalProperties: propertyCount,
        totalBookings: bookingCount
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  private async getCacheMetrics() {
    try {
      // Test cache connectivity
      const testKey = 'metrics_test'
      await cacheService.set(testKey, 'test', 10)
      await cacheService.get(testKey)
      await cacheService.delete(testKey)

      return {
        status: 'healthy',
        memory: 'N/A', // Would implement actual Redis memory usage
        hitRate: 'N/A', // Would implement actual hit rate tracking
        connections: 'N/A'
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  private getLogSeverity(level: LogLevel): 'low' | 'medium' | 'high' | 'critical' {
    switch (level) {
      case LogLevel.ERROR:
        return 'critical'
      case LogLevel.WARN:
        return 'high'
      case LogLevel.INFO:
        return 'medium'
      case LogLevel.DEBUG:
        return 'low'
      default:
        return 'low'
    }
  }

  private getAlertSummary(alerts: any[]) {
    const severityCounts = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    }

    alerts.forEach(alert => {
      const severity = this.getLogSeverity(alert.level)
      severityCounts[severity]++
    })

    const total = alerts.length
    const activeAlerts = alerts.filter(alert => {
      const alertTime = new Date(alert.timestamp)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
      return alertTime > oneHourAgo
    }).length

    return {
      total,
      active: activeAlerts,
      bySeverity: severityCounts
    }
  }

  private async getSlowQueries() {
    // In a real implementation, you would track actual query performance
    return {
      count: 0,
      queries: [],
      averageTime: 0
    }
  }

  private async getHighMemoryUsageAlerts() {
    const memoryUsage = process.memoryUsage()
    const heapPercentage = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100

    return {
      current: heapPercentage,
      threshold: 80,
      isAlert: heapPercentage > 80
    }
  }

  private async getErrorRateMetrics() {
    const stats = await logger.getLogStats(1) // Last hour
    
    return {
      rate: stats.errorRate,
      threshold: 5, // 5% error rate threshold
      isAlert: stats.errorRate > 5
    }
  }

  private generatePerformanceRecommendations(metrics: any) {
    const recommendations: string[] = []

    if (metrics.errorRates.isAlert) {
      recommendations.push('Taxa de erro alta detectada - investigar logs de erro recentes')
    }

    if (metrics.highMemoryUsage.isAlert) {
      recommendations.push('Uso de memória alto - considerar reinicialização ou otimização')
    }

    if (metrics.slowQueries.count > 10) {
      recommendations.push('Muitas consultas lentas detectadas - otimizar queries do banco')
    }

    if (recommendations.length === 0) {
      recommendations.push('Sistema operando dentro dos parâmetros normais')
    }

    return recommendations
  }
}
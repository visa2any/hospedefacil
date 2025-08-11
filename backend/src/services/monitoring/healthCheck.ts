import { FastifyInstance } from 'fastify'
import { prisma } from '@/config/database.js'
import { cacheService } from '@/config/redis.js'
import { logger, LogCategory } from './logger.js'

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  uptime: number
  version: string
  services: {
    database: ServiceHealth
    cache: ServiceHealth
    memory: ServiceHealth
    disk: ServiceHealth
  }
  metrics: {
    requests: {
      total: number
      errors: number
      errorRate: number
      averageResponseTime: number
    }
    performance: {
      cpuUsage: number
      memoryUsage: {
        used: number
        total: number
        percentage: number
      }
    }
  }
}

interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy'
  latency?: number
  message?: string
  details?: any
}

export class HealthChecker {
  private static instance: HealthChecker
  private requestCount = 0
  private errorCount = 0
  private responseTimes: number[] = []
  private readonly maxResponseTimesSample = 1000

  constructor() {
    // Clean up old response times periodically
    setInterval(() => {
      if (this.responseTimes.length > this.maxResponseTimesSample) {
        this.responseTimes = this.responseTimes.slice(-this.maxResponseTimesSample)
      }
    }, 60000) // Every minute
  }

  static getInstance(): HealthChecker {
    if (!HealthChecker.instance) {
      HealthChecker.instance = new HealthChecker()
    }
    return HealthChecker.instance
  }

  // Track request metrics
  recordRequest(responseTime: number, isError: boolean = false) {
    this.requestCount++
    this.responseTimes.push(responseTime)
    
    if (isError) {
      this.errorCount++
    }

    // Keep only recent data
    if (this.responseTimes.length > this.maxResponseTimesSample) {
      this.responseTimes.shift()
    }
  }

  // Get comprehensive health status
  async getHealthStatus(): Promise<HealthStatus> {
    const startTime = Date.now()
    
    try {
      const [dbHealth, cacheHealth, memoryHealth, diskHealth] = await Promise.all([
        this.checkDatabase(),
        this.checkCache(),
        this.checkMemory(),
        this.checkDisk()
      ])

      const metrics = this.getMetrics()
      
      // Determine overall status
      const services = { database: dbHealth, cache: cacheHealth, memory: memoryHealth, disk: diskHealth }
      const overallStatus = this.calculateOverallStatus(services)

      const healthStatus: HealthStatus = {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        services,
        metrics
      }

      // Log health check
      const checkDuration = Date.now() - startTime
      logger.info(LogCategory.SYSTEM, `Health check completed in ${checkDuration}ms`, {
        status: overallStatus,
        services: Object.fromEntries(
          Object.entries(services).map(([key, value]) => [key, value.status])
        )
      })

      return healthStatus

    } catch (error) {
      logger.error(LogCategory.SYSTEM, 'Health check failed', error)
      
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        services: {
          database: { status: 'unhealthy', message: 'Health check failed' },
          cache: { status: 'unhealthy', message: 'Health check failed' },
          memory: { status: 'unhealthy', message: 'Health check failed' },
          disk: { status: 'unhealthy', message: 'Health check failed' }
        },
        metrics: {
          requests: { total: 0, errors: 0, errorRate: 0, averageResponseTime: 0 },
          performance: { cpuUsage: 0, memoryUsage: { used: 0, total: 0, percentage: 0 } }
        }
      }
    }
  }

  // Check database connectivity and performance
  private async checkDatabase(): Promise<ServiceHealth> {
    try {
      const startTime = Date.now()
      
      // Simple query to check connectivity
      await prisma.$queryRaw`SELECT 1`
      
      const latency = Date.now() - startTime
      
      // Check database performance
      let status: ServiceHealth['status'] = 'healthy'
      let message = 'Database is healthy'
      
      if (latency > 1000) {
        status = 'unhealthy'
        message = 'Database response time is too slow'
      } else if (latency > 500) {
        status = 'degraded'
        message = 'Database response time is slow'
      }

      return {
        status,
        latency,
        message,
        details: {
          connectionPool: {
            // Would add actual pool stats in production
            activeConnections: 'N/A',
            idleConnections: 'N/A'
          }
        }
      }

    } catch (error) {
      logger.error(LogCategory.SYSTEM, 'Database health check failed', error)
      
      return {
        status: 'unhealthy',
        message: 'Database connection failed',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }
  }

  // Check Redis cache connectivity and performance
  private async checkCache(): Promise<ServiceHealth> {
    try {
      const startTime = Date.now()
      
      // Test cache with a simple operation
      const testKey = 'health_check_test'
      const testValue = Date.now().toString()
      
      await cacheService.set(testKey, testValue, 10) // 10 seconds TTL
      const retrievedValue = await cacheService.get(testKey)
      await cacheService.delete(testKey)
      
      const latency = Date.now() - startTime
      
      let status: ServiceHealth['status'] = 'healthy'
      let message = 'Cache is healthy'
      
      if (retrievedValue !== testValue) {
        return {
          status: 'unhealthy',
          message: 'Cache data integrity failed'
        }
      }
      
      if (latency > 100) {
        status = 'degraded'
        message = 'Cache response time is slow'
      }

      return {
        status,
        latency,
        message
      }

    } catch (error) {
      logger.error(LogCategory.SYSTEM, 'Cache health check failed', error)
      
      return {
        status: 'unhealthy',
        message: 'Cache connection failed',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }
  }

  // Check memory usage
  private async checkMemory(): Promise<ServiceHealth> {
    const memoryUsage = process.memoryUsage()
    const totalMemory = memoryUsage.heapTotal + memoryUsage.external
    const usedMemory = memoryUsage.heapUsed
    const memoryPercentage = (usedMemory / totalMemory) * 100

    let status: ServiceHealth['status'] = 'healthy'
    let message = 'Memory usage is normal'

    if (memoryPercentage > 90) {
      status = 'unhealthy'
      message = 'Memory usage is critically high'
    } else if (memoryPercentage > 80) {
      status = 'degraded'
      message = 'Memory usage is high'
    }

    return {
      status,
      message,
      details: {
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
        external: Math.round(memoryUsage.external / 1024 / 1024), // MB
        rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
        percentage: Math.round(memoryPercentage)
      }
    }
  }

  // Check disk space (simplified)
  private async checkDisk(): Promise<ServiceHealth> {
    try {
      const fs = await import('fs')
      const stats = fs.statSync('.')
      
      // This is a simplified check - in production you'd want to check actual disk space
      return {
        status: 'healthy',
        message: 'Disk access is normal',
        details: {
          accessible: true
        }
      }
      
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Disk access failed',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }
  }

  // Calculate overall system status
  private calculateOverallStatus(services: Record<string, ServiceHealth>): 'healthy' | 'degraded' | 'unhealthy' {
    const statuses = Object.values(services).map(service => service.status)
    
    if (statuses.includes('unhealthy')) {
      return 'unhealthy'
    }
    
    if (statuses.includes('degraded')) {
      return 'degraded'
    }
    
    return 'healthy'
  }

  // Get performance metrics
  private getMetrics() {
    const errorRate = this.requestCount > 0 ? (this.errorCount / this.requestCount) * 100 : 0
    const averageResponseTime = this.responseTimes.length > 0 
      ? this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length 
      : 0

    const memoryUsage = process.memoryUsage()
    const cpuUsage = process.cpuUsage()
    
    // Convert CPU usage to percentage (simplified)
    const cpuPercentage = (cpuUsage.user + cpuUsage.system) / 1000000 // Convert microseconds to seconds

    return {
      requests: {
        total: this.requestCount,
        errors: this.errorCount,
        errorRate: Math.round(errorRate * 100) / 100,
        averageResponseTime: Math.round(averageResponseTime * 100) / 100
      },
      performance: {
        cpuUsage: Math.round(cpuPercentage * 100) / 100,
        memoryUsage: {
          used: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
          total: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
          percentage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100)
        }
      }
    }
  }

  // Reset metrics (useful for testing or periodic resets)
  resetMetrics() {
    this.requestCount = 0
    this.errorCount = 0
    this.responseTimes = []
  }

  // Get simple status for load balancers
  async getSimpleHealthCheck(): Promise<{ status: string }> {
    const health = await this.getHealthStatus()
    return { status: health.status }
  }
}

// Register health check endpoints
export function registerHealthRoutes(fastify: FastifyInstance) {
  const healthChecker = HealthChecker.getInstance()

  // Detailed health check (for monitoring systems)
  fastify.get('/health', async (request, reply) => {
    const health = await healthChecker.getHealthStatus()
    
    const statusCode = health.status === 'healthy' ? 200 : 
                       health.status === 'degraded' ? 200 : 503
    
    reply.status(statusCode).send(health)
  })

  // Simple health check (for load balancers)
  fastify.get('/health/simple', async (request, reply) => {
    const health = await healthChecker.getSimpleHealthCheck()
    
    const statusCode = health.status === 'healthy' ? 200 : 503
    
    reply.status(statusCode).send(health)
  })

  // Readiness probe (Kubernetes)
  fastify.get('/ready', async (request, reply) => {
    try {
      // Check if the application is ready to serve requests
      await prisma.$queryRaw`SELECT 1`
      reply.status(200).send({ status: 'ready' })
    } catch (error) {
      reply.status(503).send({ status: 'not ready' })
    }
  })

  // Liveness probe (Kubernetes)
  fastify.get('/alive', async (request, reply) => {
    // Simple check to see if the process is alive
    reply.status(200).send({ 
      status: 'alive', 
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    })
  })
}

// Export singleton instance
export const healthChecker = HealthChecker.getInstance()
// System Health Check API Endpoint - Production Ready
// Monitors all critical services and dependencies

import { NextRequest, NextResponse } from 'next/server'
import { authService } from '@/lib/services/auth-service'
import { databasePropertyService } from '@/lib/services/database-property-service'
import { bookingService } from '@/lib/services/booking-service'
import { paymentService } from '@/lib/services/payment-service'
import { emailService } from '@/lib/services/email-service'
import { whatsappService } from '@/lib/services/whatsapp-service'
import { cacheService } from '@/lib/cache/cache-service'
import { liteApiService } from '@/lib/services/liteapi'

interface HealthCheckResult {
  service: string
  status: 'healthy' | 'unhealthy' | 'degraded'
  responseTime: number
  details?: any
  error?: string
}

async function healthCheckHandler(request: NextRequest) {
  const startTime = Date.now()
  const checks: HealthCheckResult[] = []
  
  try {
    console.log('🏥 Running system health check...')

    // Run all health checks in parallel for faster response
    const healthChecks = await Promise.allSettled([
      checkDatabase(),
      checkAuth(),
      checkBookingService(),
      checkPaymentService(),
      checkEmailService(),
      checkWhatsAppService(),
      checkCache(),
      checkLiteAPI(),
      checkSystemResources()
    ])

    // Process results
    healthChecks.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        checks.push(result.value)
      } else {
        checks.push({
          service: getServiceNameByIndex(index),
          status: 'unhealthy',
          responseTime: -1,
          error: result.reason?.message || 'Unknown error'
        })
      }
    })

    // Calculate overall health
    const healthyCount = checks.filter(c => c.status === 'healthy').length
    const degradedCount = checks.filter(c => c.status === 'degraded').length
    const unhealthyCount = checks.filter(c => c.status === 'unhealthy').length

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy'
    if (unhealthyCount > 0) {
      overallStatus = 'unhealthy'
    } else if (degradedCount > 0) {
      overallStatus = 'degraded'
    } else {
      overallStatus = 'healthy'
    }

    const totalResponseTime = Date.now() - startTime

    const healthData = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      responseTime: totalResponseTime,
      checks,
      summary: {
        total: checks.length,
        healthy: healthyCount,
        degraded: degradedCount,
        unhealthy: unhealthyCount
      },
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        memory: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      }
    }

    // Set appropriate HTTP status code
    const statusCode = overallStatus === 'healthy' ? 200 : 
                      overallStatus === 'degraded' ? 200 : 503

    console.log(`🏥 Health check completed: ${overallStatus} (${totalResponseTime}ms)`)

    return NextResponse.json(healthData, { status: statusCode })

  } catch (error) {
    console.error('❌ Health check failed:', error)
    
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check system failure',
      responseTime: Date.now() - startTime
    }, { status: 503 })
  }
}

async function checkDatabase(): Promise<HealthCheckResult> {
  const start = Date.now()
  try {
    const isHealthy = await databasePropertyService.isHealthy()
    const responseTime = Date.now() - start
    
    return {
      service: 'database',
      status: isHealthy ? 'healthy' : 'unhealthy',
      responseTime,
      details: {
        connection: isHealthy ? 'active' : 'failed',
        type: 'postgresql'
      }
    }
  } catch (error) {
    return {
      service: 'database',
      status: 'unhealthy',
      responseTime: Date.now() - start,
      error: error.message
    }
  }
}

async function checkAuth(): Promise<HealthCheckResult> {
  const start = Date.now()
  try {
    const isHealthy = await authService.healthCheck()
    const responseTime = Date.now() - start
    
    return {
      service: 'authentication',
      status: isHealthy ? 'healthy' : 'unhealthy',
      responseTime,
      details: {
        jwtEnabled: !!process.env.JWT_SECRET,
        userDatabase: isHealthy
      }
    }
  } catch (error) {
    return {
      service: 'authentication',
      status: 'unhealthy',
      responseTime: Date.now() - start,
      error: error.message
    }
  }
}

async function checkBookingService(): Promise<HealthCheckResult> {
  const start = Date.now()
  try {
    const isHealthy = await bookingService.isHealthy()
    const responseTime = Date.now() - start
    
    return {
      service: 'booking',
      status: isHealthy ? 'healthy' : 'unhealthy',
      responseTime,
      details: {
        database: isHealthy
      }
    }
  } catch (error) {
    return {
      service: 'booking',
      status: 'unhealthy',
      responseTime: Date.now() - start,
      error: error.message
    }
  }
}

async function checkPaymentService(): Promise<HealthCheckResult> {
  const start = Date.now()
  try {
    const isHealthy = await paymentService.healthCheck()
    const responseTime = Date.now() - start
    
    return {
      service: 'payments',
      status: isHealthy ? 'healthy' : 'degraded', // Degraded if MercadoPago is down
      responseTime,
      details: {
        mercadoPago: isHealthy,
        pixEnabled: !!process.env.NEXT_PUBLIC_PIX_KEY
      }
    }
  } catch (error) {
    return {
      service: 'payments',
      status: 'degraded',
      responseTime: Date.now() - start,
      error: error.message
    }
  }
}

async function checkEmailService(): Promise<HealthCheckResult> {
  const start = Date.now()
  try {
    const isHealthy = await emailService.healthCheck()
    const responseTime = Date.now() - start
    
    return {
      service: 'email',
      status: isHealthy ? 'healthy' : 'degraded',
      responseTime,
      details: {
        sendGrid: isHealthy,
        configured: !!process.env.SENDGRID_API_KEY
      }
    }
  } catch (error) {
    return {
      service: 'email',
      status: 'degraded',
      responseTime: Date.now() - start,
      error: error.message
    }
  }
}

async function checkWhatsAppService(): Promise<HealthCheckResult> {
  const start = Date.now()
  try {
    const isHealthy = await whatsappService.healthCheck()
    const responseTime = Date.now() - start
    
    return {
      service: 'whatsapp',
      status: isHealthy ? 'healthy' : 'degraded',
      responseTime,
      details: {
        businessAPI: isHealthy,
        configured: !!process.env.WHATSAPP_API_KEY
      }
    }
  } catch (error) {
    return {
      service: 'whatsapp',
      status: 'degraded',
      responseTime: Date.now() - start,
      error: error.message
    }
  }
}

async function checkCache(): Promise<HealthCheckResult> {
  const start = Date.now()
  try {
    const stats = await cacheService.getStats()
    const responseTime = Date.now() - start
    
    const isHealthy = stats.redis?.connected !== false
    
    return {
      service: 'cache',
      status: isHealthy ? 'healthy' : 'degraded',
      responseTime,
      details: {
        redis: {
          connected: stats.redis?.connected || false,
          memoryUsed: stats.redis?.memoryUsed,
          totalKeys: stats.redis?.totalKeys
        },
        memory: {
          size: stats.memory.size,
          hitRate: stats.memory.hitRate
        }
      }
    }
  } catch (error) {
    return {
      service: 'cache',
      status: 'degraded',
      responseTime: Date.now() - start,
      error: error.message
    }
  }
}

async function checkLiteAPI(): Promise<HealthCheckResult> {
  const start = Date.now()
  try {
    const isHealthy = await liteApiService.healthCheck()
    const responseTime = Date.now() - start
    
    return {
      service: 'liteapi',
      status: isHealthy ? 'healthy' : 'degraded',
      responseTime,
      details: {
        connection: isHealthy,
        configured: !!process.env.LITEAPI_KEY
      }
    }
  } catch (error) {
    return {
      service: 'liteapi',
      status: 'degraded',
      responseTime: Date.now() - start,
      error: error.message
    }
  }
}

async function checkSystemResources(): Promise<HealthCheckResult> {
  const start = Date.now()
  try {
    const memoryUsage = process.memoryUsage()
    const cpuUsage = process.cpuUsage()
    
    // Check if memory usage is concerning (>90% of 512MB default)
    const memoryThreshold = 512 * 1024 * 1024 * 0.9 // 90% of 512MB
    const isMemoryOk = memoryUsage.heapUsed < memoryThreshold
    
    const responseTime = Date.now() - start
    
    return {
      service: 'system',
      status: isMemoryOk ? 'healthy' : 'degraded',
      responseTime,
      details: {
        memory: {
          heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
          external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`,
          rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system
        },
        uptime: `${Math.round(process.uptime())}s`,
        nodeVersion: process.version
      }
    }
  } catch (error) {
    return {
      service: 'system',
      status: 'unhealthy',
      responseTime: Date.now() - start,
      error: error.message
    }
  }
}

function getServiceNameByIndex(index: number): string {
  const serviceNames = [
    'database',
    'authentication', 
    'booking',
    'payments',
    'email',
    'whatsapp',
    'cache',
    'liteapi',
    'system'
  ]
  return serviceNames[index] || 'unknown'
}

export { healthCheckHandler as GET }
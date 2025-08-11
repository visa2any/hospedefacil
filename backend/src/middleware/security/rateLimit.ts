import { FastifyRequest, FastifyReply } from 'fastify'
import { cacheService } from '@/config/redis.js'

interface RateLimitOptions {
  windowMs: number // Time window in milliseconds
  max: number // Maximum number of requests per window
  message?: string
  skipSuccessfulRequests?: boolean
  skipFailedRequests?: boolean
  keyGenerator?: (request: FastifyRequest) => string
}

export class RateLimiter {
  private options: RateLimitOptions

  constructor(options: RateLimitOptions) {
    this.options = {
      message: 'Muitas tentativas. Tente novamente mais tarde.',
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      keyGenerator: (request: FastifyRequest) => this.getClientIP(request),
      ...options
    }
  }

  async middleware(request: FastifyRequest, reply: FastifyReply) {
    try {
      const key = this.options.keyGenerator!(request)
      const redisKey = `rate_limit:${key}`
      
      // Get current count
      const current = await cacheService.get(redisKey)
      const count = current ? parseInt(current) : 0

      // Check if limit exceeded
      if (count >= this.options.max) {
        const ttl = await cacheService.getTTL(redisKey)
        
        reply.status(429).send({
          error: 'Rate limit exceeded',
          message: this.options.message,
          retryAfter: Math.ceil(ttl / 1000)
        })
        return
      }

      // Increment counter
      const newCount = count + 1
      const isFirstRequest = count === 0

      if (isFirstRequest) {
        await cacheService.set(redisKey, newCount.toString(), Math.floor(this.options.windowMs / 1000))
      } else {
        await cacheService.increment(redisKey)
      }

      // Add rate limit headers
      reply.headers({
        'X-RateLimit-Limit': this.options.max.toString(),
        'X-RateLimit-Remaining': Math.max(0, this.options.max - newCount).toString(),
        'X-RateLimit-Reset': new Date(Date.now() + this.options.windowMs).toISOString()
      })

    } catch (error) {
      console.error('Rate limiting error:', error)
      // Continue without rate limiting if Redis fails
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
}

// Predefined rate limiters for different endpoints
export const rateLimiters = {
  // General API rate limit
  general: new RateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000 // requests per window
  }),

  // Authentication endpoints (stricter)
  auth: new RateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // requests per window
    message: 'Muitas tentativas de login. Aguarde 15 minutos.'
  }),

  // Payment endpoints (very strict)
  payment: new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // requests per window
    message: 'Limite de transações excedido. Aguarde 1 minuto.',
    keyGenerator: (request: FastifyRequest) => {
      const userAgent = request.headers['user-agent'] || ''
      const ip = request.ip || 'unknown'
      const userId = request.user?.id || 'anonymous'
      return `${ip}:${userId}:${userAgent.slice(0, 50)}`
    }
  }),

  // Search endpoints (moderate)
  search: new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 100 // requests per window
  }),

  // File upload (strict)
  upload: new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 20 // requests per window
  }),

  // Password reset (very strict)
  passwordReset: new RateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // requests per window
    message: 'Limite de tentativas de redefinição de senha excedido. Aguarde 1 hora.'
  }),

  // Admin endpoints (moderate but monitored)
  admin: new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 200 // requests per window
  })
}

// Rate limiting middleware factory
export function createRateLimit(options: RateLimitOptions) {
  const limiter = new RateLimiter(options)
  return async (request: FastifyRequest, reply: FastifyReply) => {
    await limiter.middleware(request, reply)
  }
}
import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'

// Security validation schemas
const securityHeaders = z.object({
  'user-agent': z.string().min(1).max(500).optional(),
  'x-forwarded-for': z.string().max(100).optional(),
  'x-real-ip': z.string().max(50).optional(),
  'referer': z.string().max(500).optional(),
  'origin': z.string().max(200).optional()
})

const commonValidations = {
  // SQL injection patterns
  sqlInjectionPattern: /(\b(ALTER|CREATE|DELETE|DROP|EXEC(UTE)?|INSERT|MERGE|SELECT|UPDATE|UNION|USE)\b)|(\b(OR|AND)\s+\d+=\d+)|(\b(OR|AND)\s+['"]\w+['"]?\s*=\s*['"]\w+['"]?)|(-{2,}|\/\*|\*\/)/i,
  
  // XSS patterns
  xssPattern: /<script[^>]*>.*?<\/script>|javascript:|on\w+\s*=|<iframe|<object|<embed|<link|<meta|<style/i,
  
  // Path traversal patterns
  pathTraversalPattern: /\.\.[\/\\]|~[\/\\]|%2e%2e[\/\\]|\.%2e[\/\\]|%2e\.[\/\\]/i,
  
  // Command injection patterns
  commandInjectionPattern: /[;&|`$(){}[\]\\]/,
  
  // NoSQL injection patterns
  noSqlInjectionPattern: /\$where|\$ne|\$gt|\$lt|\$gte|\$lte|\$regex|\$options|\$elemMatch|\$size/i
}

interface SecurityValidationOptions {
  checkSqlInjection?: boolean
  checkXss?: boolean
  checkPathTraversal?: boolean
  checkCommandInjection?: boolean
  checkNoSqlInjection?: boolean
  maxBodySize?: number
  allowedOrigins?: string[]
  requiredHeaders?: string[]
}

export class RequestValidator {
  private options: SecurityValidationOptions

  constructor(options: SecurityValidationOptions = {}) {
    this.options = {
      checkSqlInjection: true,
      checkXss: true,
      checkPathTraversal: true,
      checkCommandInjection: false,
      checkNoSqlInjection: true,
      maxBodySize: 10 * 1024 * 1024, // 10MB
      allowedOrigins: [],
      requiredHeaders: [],
      ...options
    }
  }

  async validateRequest(request: FastifyRequest, reply: FastifyReply) {
    try {
      // Validate headers
      await this.validateHeaders(request)
      
      // Validate origin
      this.validateOrigin(request)
      
      // Validate request size
      this.validateSize(request)
      
      // Validate URL parameters
      this.validateParams(request.params)
      
      // Validate query parameters
      this.validateQuery(request.query)
      
      // Validate body
      if (request.body) {
        this.validateBody(request.body)
      }
      
      // Log suspicious activity
      this.checkSuspiciousActivity(request)
      
    } catch (error) {
      console.warn('Request validation failed:', {
        error: error instanceof Error ? error.message : error,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        url: request.url,
        method: request.method
      })
      
      reply.status(400).send({
        error: 'Invalid request',
        message: 'A solicitação contém dados inválidos ou potencialmente perigosos.'
      })
      return
    }
  }

  private async validateHeaders(request: FastifyRequest) {
    try {
      securityHeaders.parse(request.headers)
    } catch (error) {
      throw new Error('Invalid headers')
    }

    // Check for required headers
    for (const header of this.options.requiredHeaders || []) {
      if (!request.headers[header.toLowerCase()]) {
        throw new Error(`Required header missing: ${header}`)
      }
    }

    // Check User-Agent
    const userAgent = request.headers['user-agent']
    if (userAgent && this.isSuspiciousUserAgent(userAgent)) {
      throw new Error('Suspicious user agent')
    }
  }

  private validateOrigin(request: FastifyRequest) {
    if (this.options.allowedOrigins && this.options.allowedOrigins.length > 0) {
      const origin = request.headers.origin
      const referer = request.headers.referer
      
      if (origin && !this.options.allowedOrigins.includes(origin)) {
        throw new Error('Origin not allowed')
      }
      
      if (referer) {
        const refererOrigin = new URL(referer).origin
        if (!this.options.allowedOrigins.includes(refererOrigin)) {
          throw new Error('Referer origin not allowed')
        }
      }
    }
  }

  private validateSize(request: FastifyRequest) {
    const contentLength = request.headers['content-length']
    if (contentLength && parseInt(contentLength) > (this.options.maxBodySize || 10485760)) {
      throw new Error('Request too large')
    }
  }

  private validateParams(params: any) {
    if (params && typeof params === 'object') {
      this.validateObject(params)
    }
  }

  private validateQuery(query: any) {
    if (query && typeof query === 'object') {
      this.validateObject(query)
    }
  }

  private validateBody(body: any) {
    if (typeof body === 'string') {
      this.validateString(body)
    } else if (typeof body === 'object') {
      this.validateObject(body)
    }
  }

  private validateObject(obj: any) {
    for (const [key, value] of Object.entries(obj)) {
      // Validate key
      this.validateString(key)
      
      // Validate value recursively
      if (typeof value === 'string') {
        this.validateString(value)
      } else if (typeof value === 'object' && value !== null) {
        this.validateObject(value)
      }
    }
  }

  private validateString(str: string) {
    if (this.options.checkSqlInjection && commonValidations.sqlInjectionPattern.test(str)) {
      throw new Error('Potential SQL injection detected')
    }
    
    if (this.options.checkXss && commonValidations.xssPattern.test(str)) {
      throw new Error('Potential XSS attack detected')
    }
    
    if (this.options.checkPathTraversal && commonValidations.pathTraversalPattern.test(str)) {
      throw new Error('Potential path traversal detected')
    }
    
    if (this.options.checkCommandInjection && commonValidations.commandInjectionPattern.test(str)) {
      throw new Error('Potential command injection detected')
    }
    
    if (this.options.checkNoSqlInjection && commonValidations.noSqlInjectionPattern.test(str)) {
      throw new Error('Potential NoSQL injection detected')
    }
  }

  private isSuspiciousUserAgent(userAgent: string): boolean {
    const suspiciousPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /curl/i,
      /wget/i,
      /python/i,
      /php/i,
      /java/i,
      /go-http-client/i,
      /postman/i,
      /insomnia/i
    ]
    
    return suspiciousPatterns.some(pattern => pattern.test(userAgent))
  }

  private checkSuspiciousActivity(request: FastifyRequest) {
    const suspiciousIndicators: string[] = []
    
    // Check for suspicious paths
    if (/\/(admin|wp-admin|wp-login|phpmyadmin|login\.php|config\.php)/i.test(request.url)) {
      suspiciousIndicators.push('suspicious_path')
    }
    
    // Check for suspicious extensions
    if (/\.(php|asp|jsp|cgi|pl|py|sh|bat|exe)$/i.test(request.url)) {
      suspiciousIndicators.push('suspicious_extension')
    }
    
    // Check for too many parameters
    const queryParams = Object.keys(request.query || {})
    if (queryParams.length > 20) {
      suspiciousIndicators.push('too_many_params')
    }
    
    // Check for unusual methods
    if (!['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'].includes(request.method)) {
      suspiciousIndicators.push('unusual_method')
    }
    
    // Log if suspicious
    if (suspiciousIndicators.length > 0) {
      console.warn('Suspicious activity detected:', {
        indicators: suspiciousIndicators,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        url: request.url,
        method: request.method,
        timestamp: new Date().toISOString()
      })
    }
  }
}

// Predefined validators for different security levels
export const validators = {
  // High security for admin endpoints
  high: new RequestValidator({
    checkSqlInjection: true,
    checkXss: true,
    checkPathTraversal: true,
    checkCommandInjection: true,
    checkNoSqlInjection: true,
    maxBodySize: 1 * 1024 * 1024, // 1MB
    requiredHeaders: ['user-agent']
  }),
  
  // Medium security for API endpoints
  medium: new RequestValidator({
    checkSqlInjection: true,
    checkXss: true,
    checkPathTraversal: true,
    checkNoSqlInjection: true,
    maxBodySize: 10 * 1024 * 1024 // 10MB
  }),
  
  // Low security for public endpoints
  low: new RequestValidator({
    checkSqlInjection: true,
    checkXss: true,
    maxBodySize: 5 * 1024 * 1024 // 5MB
  }),

  // File upload security
  upload: new RequestValidator({
    checkPathTraversal: true,
    maxBodySize: 50 * 1024 * 1024 // 50MB
  })
}

// Validation middleware factory
export function createValidator(level: 'high' | 'medium' | 'low' | 'upload' = 'medium') {
  const validator = validators[level]
  return async (request: FastifyRequest, reply: FastifyReply) => {
    await validator.validateRequest(request, reply)
  }
}
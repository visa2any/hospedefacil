import { FastifyRequest, FastifyReply } from 'fastify'

interface CorsOptions {
  origin?: string[] | string | boolean | ((origin: string, callback: (error: Error | null, allow?: boolean) => void) => void)
  methods?: string[]
  allowedHeaders?: string[]
  credentials?: boolean
  maxAge?: number
  preflightContinue?: boolean
  optionsSuccessStatus?: number
}

export class CorsHandler {
  private options: CorsOptions

  constructor(options: CorsOptions = {}) {
    this.options = {
      origin: process.env.NODE_ENV === 'production' 
        ? [
            'https://hospedefacil.com.br',
            'https://www.hospedefacil.com.br',
            'https://app.hospedefacil.com.br',
            'https://admin.hospedefacil.com.br'
          ]
        : true, // Allow all origins in development
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'Cache-Control',
        'X-Forwarded-For',
        'X-Real-IP',
        'User-Agent'
      ],
      credentials: true,
      maxAge: 86400, // 24 hours
      optionsSuccessStatus: 204,
      ...options
    }
  }

  async handleCors(request: FastifyRequest, reply: FastifyReply) {
    const origin = request.headers.origin

    // Handle origin
    if (this.shouldAllowOrigin(origin)) {
      reply.header('Access-Control-Allow-Origin', origin || '*')
    }

    // Handle credentials
    if (this.options.credentials) {
      reply.header('Access-Control-Allow-Credentials', 'true')
    }

    // Handle methods
    if (this.options.methods) {
      reply.header('Access-Control-Allow-Methods', this.options.methods.join(', '))
    }

    // Handle headers
    if (this.options.allowedHeaders) {
      reply.header('Access-Control-Allow-Headers', this.options.allowedHeaders.join(', '))
    }

    // Handle max age
    if (this.options.maxAge) {
      reply.header('Access-Control-Max-Age', this.options.maxAge.toString())
    }

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      reply.status(this.options.optionsSuccessStatus || 204).send()
      return
    }
  }

  private shouldAllowOrigin(origin?: string): boolean {
    if (!origin) {
      return false
    }

    const allowedOrigins = this.options.origin

    if (allowedOrigins === true) {
      return true
    }

    if (allowedOrigins === false) {
      return false
    }

    if (typeof allowedOrigins === 'string') {
      return origin === allowedOrigins
    }

    if (Array.isArray(allowedOrigins)) {
      return allowedOrigins.includes(origin)
    }

    if (typeof allowedOrigins === 'function') {
      return new Promise((resolve) => {
        allowedOrigins(origin, (error, allow) => {
          resolve(!error && allow === true)
        })
      }) as any // This would need proper async handling in real implementation
    }

    return false
  }
}

// Predefined CORS configurations
export const corsConfigurations = {
  // Production CORS - Strict origins
  production: new CorsHandler({
    origin: [
      'https://hospedefacil.com.br',
      'https://www.hospedefacil.com.br',
      'https://app.hospedefacil.com.br',
      'https://admin.hospedefacil.com.br'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    maxAge: 86400
  }),

  // Development CORS - Allow all origins
  development: new CorsHandler({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    maxAge: 300 // 5 minutes for faster development
  }),

  // API-only CORS - No credentials
  api: new CorsHandler({
    origin: [
      'https://hospedefacil.com.br',
      'https://app.hospedefacil.com.br'
    ],
    credentials: false,
    methods: ['GET', 'POST'],
    maxAge: 3600 // 1 hour
  }),

  // Admin CORS - Very strict
  admin: new CorsHandler({
    origin: [
      'https://admin.hospedefacil.com.br'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Admin-Token'
    ],
    maxAge: 600 // 10 minutes
  })
}

// CORS middleware factory
export function createCorsHandler(environment: 'production' | 'development' | 'api' | 'admin' = 'development') {
  const corsHandler = corsConfigurations[environment]
  
  return async (request: FastifyRequest, reply: FastifyReply) => {
    await corsHandler.handleCors(request, reply)
  }
}
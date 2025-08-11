// Authentication Middleware - Production Ready
// Protects routes and validates JWT tokens

import { NextRequest, NextResponse } from 'next/server'
import { authService, AuthUser } from '../services/auth-service'

// Extended NextRequest with user data
export interface AuthenticatedRequest extends NextRequest {
  user?: AuthUser
}

export interface AuthMiddlewareOptions {
  roles?: string[]
  requireVerification?: boolean
  optional?: boolean // Allow both authenticated and unauthenticated access
}

// Main authentication middleware
export async function authMiddleware(
  request: NextRequest,
  options: AuthMiddlewareOptions = {}
): Promise<{
  response?: NextResponse
  user?: AuthUser
  isAuthenticated: boolean
}> {
  try {
    // Extract token from various sources
    const token = extractToken(request)
    
    if (!token) {
      if (options.optional) {
        return { isAuthenticated: false }
      }
      return {
        response: createUnauthorizedResponse('Authentication required'),
        isAuthenticated: false
      }
    }

    // Verify token and get user
    const user = await authService.verifyToken(token)
    
    if (!user) {
      if (options.optional) {
        return { isAuthenticated: false }
      }
      return {
        response: createUnauthorizedResponse('Invalid or expired token'),
        isAuthenticated: false
      }
    }

    // Check if user is verified (if required)
    if (options.requireVerification && !user.isVerified) {
      return {
        response: createForbiddenResponse('Email verification required'),
        isAuthenticated: true,
        user
      }
    }

    // Check role authorization
    if (options.roles?.length && !options.roles.includes(user.role)) {
      return {
        response: createForbiddenResponse('Insufficient permissions'),
        isAuthenticated: true,
        user
      }
    }

    // User is authenticated and authorized
    return {
      isAuthenticated: true,
      user
    }

  } catch (error) {
    console.error('❌ Auth middleware error:', error)
    return {
      response: createServerErrorResponse('Authentication error'),
      isAuthenticated: false
    }
  }
}

// Route protection wrapper for API routes
export function withAuth(
  handler: (req: AuthenticatedRequest, user: AuthUser) => Promise<Response>,
  options: AuthMiddlewareOptions = {}
) {
  return async (request: NextRequest): Promise<Response> => {
    const authResult = await authMiddleware(request, options)
    
    if (authResult.response) {
      return authResult.response
    }

    if (!authResult.isAuthenticated || !authResult.user) {
      return createUnauthorizedResponse('Authentication failed')
    }

    // Add user to request object
    const authenticatedRequest = request as AuthenticatedRequest
    authenticatedRequest.user = authResult.user

    // Call the actual handler
    try {
      return await handler(authenticatedRequest, authResult.user)
    } catch (error) {
      console.error('❌ Route handler error:', error)
      return createServerErrorResponse('Internal server error')
    }
  }
}

// Guest-only routes (must NOT be authenticated)
export function withGuestOnly(
  handler: (req: NextRequest) => Promise<Response>
) {
  return async (request: NextRequest): Promise<Response> => {
    const token = extractToken(request)
    
    if (token) {
      const user = await authService.verifyToken(token)
      if (user) {
        return createForbiddenResponse('Already authenticated')
      }
    }

    return await handler(request)
  }
}

// Role-specific middleware
export function requireHost(
  handler: (req: AuthenticatedRequest, user: AuthUser) => Promise<Response>
) {
  return withAuth(handler, { 
    roles: ['HOST'], 
    requireVerification: true 
  })
}

export function requireAdmin(
  handler: (req: AuthenticatedRequest, user: AuthUser) => Promise<Response>
) {
  return withAuth(handler, { 
    roles: ['ADMIN'], 
    requireVerification: true 
  })
}

export function requireVerified(
  handler: (req: AuthenticatedRequest, user: AuthUser) => Promise<Response>
) {
  return withAuth(handler, { 
    requireVerification: true 
  })
}

// Optional auth (works for both authenticated and unauthenticated)
export function withOptionalAuth(
  handler: (req: AuthenticatedRequest, user?: AuthUser) => Promise<Response>
) {
  return async (request: NextRequest): Promise<Response> => {
    const authResult = await authMiddleware(request, { optional: true })
    
    const authenticatedRequest = request as AuthenticatedRequest
    authenticatedRequest.user = authResult.user

    try {
      return await handler(authenticatedRequest, authResult.user)
    } catch (error) {
      console.error('❌ Route handler error:', error)
      return createServerErrorResponse('Internal server error')
    }
  }
}

// Helper functions

function extractToken(request: NextRequest): string | null {
  // Try Authorization header first
  const authHeader = request.headers.get('authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }

  // Try cookie fallback
  const cookieToken = request.cookies.get('auth_token')?.value
  if (cookieToken) {
    return cookieToken
  }

  // Try query parameter (for special cases like email verification)
  const urlToken = new URL(request.url).searchParams.get('token')
  if (urlToken) {
    return urlToken
  }

  return null
}

function createUnauthorizedResponse(message: string): NextResponse {
  return NextResponse.json(
    { 
      error: 'Unauthorized', 
      message,
      code: 'UNAUTHORIZED'
    }, 
    { status: 401 }
  )
}

function createForbiddenResponse(message: string): NextResponse {
  return NextResponse.json(
    { 
      error: 'Forbidden', 
      message,
      code: 'FORBIDDEN'
    }, 
    { status: 403 }
  )
}

function createServerErrorResponse(message: string): NextResponse {
  return NextResponse.json(
    { 
      error: 'Internal Server Error', 
      message,
      code: 'INTERNAL_ERROR'
    }, 
    { status: 500 }
  )
}

// Rate limiting per user
const userRateLimits = new Map<string, { count: number; resetTime: number }>()

export function withRateLimit(
  handler: (req: NextRequest) => Promise<Response>,
  options: {
    maxRequests: number
    windowMs: number
    keyGenerator?: (req: NextRequest) => string
  }
) {
  return async (request: NextRequest): Promise<Response> => {
    const key = options.keyGenerator 
      ? options.keyGenerator(request)
      : request.ip || 'anonymous'
    
    const now = Date.now()
    const userLimit = userRateLimits.get(key)
    
    if (!userLimit || now > userLimit.resetTime) {
      // Reset or create new limit window
      userRateLimits.set(key, {
        count: 1,
        resetTime: now + options.windowMs
      })
    } else if (userLimit.count >= options.maxRequests) {
      // Rate limit exceeded
      return NextResponse.json(
        {
          error: 'Rate Limit Exceeded',
          message: 'Too many requests',
          retryAfter: Math.ceil((userLimit.resetTime - now) / 1000)
        },
        { 
          status: 429,
          headers: {
            'Retry-After': Math.ceil((userLimit.resetTime - now) / 1000).toString(),
            'X-RateLimit-Limit': options.maxRequests.toString(),
            'X-RateLimit-Remaining': (options.maxRequests - userLimit.count).toString(),
            'X-RateLimit-Reset': new Date(userLimit.resetTime).toISOString()
          }
        }
      )
    } else {
      // Increment counter
      userLimit.count++
    }

    return await handler(request)
  }
}

// CORS middleware
export function withCors(
  handler: (req: NextRequest) => Promise<Response>,
  options: {
    origin?: string | string[]
    methods?: string[]
    headers?: string[]
    credentials?: boolean
  } = {}
) {
  return async (request: NextRequest): Promise<Response> => {
    const origin = request.headers.get('origin')
    const allowedOrigins = Array.isArray(options.origin) ? options.origin : [options.origin || '*']
    
    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || '*',
          'Access-Control-Allow-Methods': (options.methods || ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']).join(', '),
          'Access-Control-Allow-Headers': (options.headers || ['Content-Type', 'Authorization']).join(', '),
          'Access-Control-Allow-Credentials': options.credentials ? 'true' : 'false',
          'Access-Control-Max-Age': '86400'
        }
      })
    }

    // Handle actual request
    const response = await handler(request)
    
    // Add CORS headers to response
    const corsHeaders = new Headers(response.headers)
    corsHeaders.set('Access-Control-Allow-Origin', origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || '*')
    if (options.credentials) {
      corsHeaders.set('Access-Control-Allow-Credentials', 'true')
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: corsHeaders
    })
  }
}

// Request validation middleware
export function withValidation<T>(
  handler: (req: NextRequest, validatedData: T) => Promise<Response>,
  schema: (data: any) => { isValid: boolean; errors: string[]; data?: T }
) {
  return async (request: NextRequest): Promise<Response> => {
    try {
      let data: any

      // Parse request body based on content type
      const contentType = request.headers.get('content-type') || ''
      
      if (contentType.includes('application/json')) {
        data = await request.json()
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        const formData = await request.formData()
        data = Object.fromEntries(formData)
      } else {
        data = {}
      }

      // Validate data
      const validation = schema(data)
      
      if (!validation.isValid) {
        return NextResponse.json(
          {
            error: 'Validation Error',
            message: 'Invalid request data',
            details: validation.errors
          },
          { status: 400 }
        )
      }

      return await handler(request, validation.data!)

    } catch (error) {
      console.error('❌ Request validation error:', error)
      return NextResponse.json(
        {
          error: 'Bad Request',
          message: 'Invalid request format'
        },
        { status: 400 }
      )
    }
  }
}

// Logging middleware
export function withLogging(
  handler: (req: NextRequest) => Promise<Response>,
  logLevel: 'info' | 'debug' = 'info'
) {
  return async (request: NextRequest): Promise<Response> => {
    const start = Date.now()
    const method = request.method
    const url = request.url
    const userAgent = request.headers.get('user-agent') || 'unknown'
    const ip = request.ip || 'unknown'

    if (logLevel === 'debug') {
      console.log(`📝 ${method} ${url} - ${ip} - ${userAgent}`)
    }

    try {
      const response = await handler(request)
      const duration = Date.now() - start
      
      console.log(`✅ ${method} ${url} - ${response.status} - ${duration}ms`)
      
      return response
    } catch (error) {
      const duration = Date.now() - start
      console.error(`❌ ${method} ${url} - ERROR - ${duration}ms:`, error)
      throw error
    }
  }
}

// Security headers middleware
export function withSecurity(handler: (req: NextRequest) => Promise<Response>) {
  return async (request: NextRequest): Promise<Response> => {
    const response = await handler(request)
    
    const securityHeaders = new Headers(response.headers)
    securityHeaders.set('X-Frame-Options', 'DENY')
    securityHeaders.set('X-Content-Type-Options', 'nosniff')
    securityHeaders.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    securityHeaders.set('X-XSS-Protection', '1; mode=block')
    securityHeaders.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: securityHeaders
    })
  }
}
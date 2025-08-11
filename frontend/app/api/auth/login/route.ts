// User Login API Endpoint - Production Ready
import { NextRequest, NextResponse } from 'next/server'
import { authService } from '@/lib/services/auth-service'
import { withValidation, withRateLimit, withCors, withSecurity } from '@/lib/middleware/auth-middleware'

interface LoginRequestData {
  email: string
  password: string
  rememberMe?: boolean
}

// Request validation schema
function validateLoginRequest(data: any): {
  isValid: boolean
  errors: string[]
  data?: LoginRequestData
} {
  const errors: string[] = []

  // Required fields
  if (!data.email?.trim()) {
    errors.push('Email is required')
  }
  if (!data.password) {
    errors.push('Password is required')
  }

  // Email format validation
  if (data.email && !data.email.includes('@')) {
    errors.push('Invalid email format')
  }

  return {
    isValid: errors.length === 0,
    errors,
    data: errors.length === 0 ? data : undefined
  }
}

async function loginHandler(request: NextRequest, validatedData: LoginRequestData) {
  try {
    console.log('🔐 User login attempt:', validatedData.email)

    // Attempt login
    const result = await authService.login({
      email: validatedData.email.toLowerCase().trim(),
      password: validatedData.password
    })

    if (!result) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid credentials',
          message: 'Invalid email or password. Please check your credentials and try again.' 
        },
        { status: 401 }
      )
    }

    console.log('✅ User logged in successfully:', result.user.id)

    // Create response
    const response = NextResponse.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          role: result.user.role,
          avatar: result.user.avatar,
          isVerified: result.user.isVerified,
          hostProfile: result.user.hostProfile
        },
        tokens: result.tokens
      }
    })

    // Set HTTP-only cookies for tokens if "remember me" is enabled
    if (validatedData.rememberMe) {
      response.cookies.set('auth_token', result.tokens.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60, // 1 hour
        path: '/'
      })

      response.cookies.set('refresh_token', result.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60, // 7 days
        path: '/'
      })
    }

    return response

  } catch (error) {
    console.error('❌ Login failed:', error)
    
    // Handle specific error cases
    if (error.message.includes('Invalid credentials')) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid credentials',
          message: 'Invalid email or password. Please check your credentials and try again.' 
        },
        { status: 401 }
      )
    }

    if (error.message.includes('Account suspended')) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Account suspended',
          message: 'Your account has been suspended. Please contact support for assistance.' 
        },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred. Please try again later.' 
      },
      { status: 500 }
    )
  }
}

// Apply middleware chain
const handler = withSecurity(
  withCors(
    withRateLimit(
      withValidation(loginHandler, validateLoginRequest),
      {
        maxRequests: 10, // 10 login attempts
        windowMs: 15 * 60 * 1000, // per 15 minutes
        keyGenerator: (req) => {
          const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'anonymous'
          return `login:${ip}`
        }
      }
    ),
    {
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['*'],
      methods: ['POST', 'OPTIONS'],
      headers: ['Content-Type', 'Authorization'],
      credentials: true
    }
  )
)

export { handler as POST }
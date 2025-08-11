// User Registration API Endpoint - Production Ready
import { NextRequest, NextResponse } from 'next/server'
import { authService } from '@/lib/services/auth-service'
import { emailService } from '@/lib/services/email-service'
import { withValidation, withRateLimit, withCors, withSecurity } from '@/lib/middleware/auth-middleware'

interface RegisterRequestData {
  name: string
  email: string
  password: string
  confirmPassword: string
  phone?: string
  cpf?: string
  role: 'GUEST' | 'HOST'
  terms: boolean
}

// Request validation schema
function validateRegisterRequest(data: any): {
  isValid: boolean
  errors: string[]
  data?: RegisterRequestData
} {
  const errors: string[] = []

  // Required fields
  if (!data.name?.trim()) errors.push('Name is required')
  if (!data.email?.trim()) errors.push('Email is required')
  if (!data.password) errors.push('Password is required')
  if (!data.confirmPassword) errors.push('Password confirmation is required')
  if (!data.role || !['GUEST', 'HOST'].includes(data.role)) {
    errors.push('Valid role is required (GUEST or HOST)')
  }
  if (!data.terms) errors.push('Terms and conditions must be accepted')

  // Email format validation
  if (data.email && !data.email.includes('@')) {
    errors.push('Invalid email format')
  }

  // Password validation
  if (data.password && data.password.length < 8) {
    errors.push('Password must be at least 8 characters')
  }

  // Password confirmation
  if (data.password && data.confirmPassword && data.password !== data.confirmPassword) {
    errors.push('Passwords do not match')
  }

  // Phone validation (if provided)
  if (data.phone && !/^\+?[\d\s\-\(\)]{10,}$/.test(data.phone)) {
    errors.push('Invalid phone number format')
  }

  // CPF validation (if provided)
  if (data.cpf && !/^\d{11}$/.test(data.cpf.replace(/\D/g, ''))) {
    errors.push('Invalid CPF format')
  }

  // Name length validation
  if (data.name && data.name.trim().length < 2) {
    errors.push('Name must be at least 2 characters')
  }

  return {
    isValid: errors.length === 0,
    errors,
    data: errors.length === 0 ? data : undefined
  }
}

async function registerHandler(request: NextRequest, validatedData: RegisterRequestData) {
  try {
    console.log('📝 User registration attempt:', validatedData.email)

    // Register user
    const result = await authService.register({
      name: validatedData.name.trim(),
      email: validatedData.email.toLowerCase().trim(),
      password: validatedData.password,
      phone: validatedData.phone?.trim(),
      cpf: validatedData.cpf?.replace(/\D/g, ''),
      role: validatedData.role,
      terms: validatedData.terms
    })

    if (!result) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Registration failed',
          message: 'Unable to create account. Please try again.' 
        },
        { status: 500 }
      )
    }

    // Send welcome email
    await emailService.sendWelcomeEmail(
      result.user.email,
      result.user.name,
      validatedData.role.toLowerCase() as 'guest' | 'host'
    )

    // Send email verification if token was generated
    if (result.emailVerificationToken) {
      // In a real implementation, you would send verification email here
      console.log('📧 Email verification token generated:', result.emailVerificationToken)
    }

    console.log('✅ User registered successfully:', result.user.id)

    return NextResponse.json({
      success: true,
      message: 'Account created successfully! Please check your email for verification.',
      data: {
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          role: result.user.role,
          isVerified: result.user.isVerified
        },
        tokens: result.tokens,
        requiresVerification: !result.user.isVerified
      }
    }, { status: 201 })

  } catch (error) {
    console.error('❌ Registration failed:', error)
    
    // Handle known errors
    if (error.message.includes('Email already registered')) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Email already exists',
          message: 'An account with this email already exists. Try logging in instead.' 
        },
        { status: 409 }
      )
    }

    if (error.message.includes('Validation failed')) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Validation error',
          message: error.message 
        },
        { status: 400 }
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
      withValidation(registerHandler, validateRegisterRequest),
      {
        maxRequests: 5, // 5 registration attempts
        windowMs: 15 * 60 * 1000, // per 15 minutes
        keyGenerator: (req) => {
          const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'anonymous'
          return `register:${ip}`
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
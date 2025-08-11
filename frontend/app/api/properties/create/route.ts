// Create Property API Endpoint - Production Ready
import { NextRequest, NextResponse } from 'next/server'
import { databasePropertyService } from '@/lib/services/database-property-service'
import { withAuth, withValidation, withRateLimit, withCors, withSecurity } from '@/lib/middleware/auth-middleware'
import { PropertyType } from '@/lib/database/schemas'

interface CreatePropertyRequestData {
  title: string
  description: string
  type: PropertyType
  address: string
  city: string
  state: string
  zipCode: string
  coordinates: { lat: number; lng: number }
  bedrooms: number
  bathrooms: number
  beds: number
  maxGuests: number
  basePrice: number
  cleaningFee?: number
  serviceFee?: number
  amenities: string[]
  images: Array<{ url: string; alt: string }>
  houseRules?: string[]
  checkInTime?: string
  checkOutTime?: string
  minStay?: number
  maxStay?: number
}

// Validation schema for property creation
function validateCreatePropertyRequest(data: any): {
  isValid: boolean
  errors: string[]
  data?: CreatePropertyRequestData
} {
  const errors: string[] = []

  // Required fields validation
  if (!data.title?.trim()) errors.push('Property title is required')
  if (!data.description?.trim()) errors.push('Property description is required')
  if (!data.type || !Object.values(PropertyType).includes(data.type)) {
    errors.push('Valid property type is required')
  }
  if (!data.address?.trim()) errors.push('Address is required')
  if (!data.city?.trim()) errors.push('City is required')
  if (!data.state?.trim()) errors.push('State is required')
  if (!data.zipCode?.trim()) errors.push('ZIP code is required')

  // Coordinates validation
  if (!data.coordinates || typeof data.coordinates.lat !== 'number' || typeof data.coordinates.lng !== 'number') {
    errors.push('Valid coordinates are required')
  }

  // Numeric validations
  if (!Number.isInteger(data.bedrooms) || data.bedrooms < 0) {
    errors.push('Bedrooms must be a non-negative integer')
  }
  if (!Number.isInteger(data.bathrooms) || data.bathrooms < 1) {
    errors.push('At least 1 bathroom is required')
  }
  if (!Number.isInteger(data.beds) || data.beds < 1) {
    errors.push('At least 1 bed is required')
  }
  if (!Number.isInteger(data.maxGuests) || data.maxGuests < 1) {
    errors.push('At least 1 guest capacity is required')
  }
  if (!data.basePrice || data.basePrice < 20) {
    errors.push('Base price must be at least R$ 20')
  }

  // Optional numeric validations
  if (data.cleaningFee !== undefined && (typeof data.cleaningFee !== 'number' || data.cleaningFee < 0)) {
    errors.push('Cleaning fee must be a non-negative number')
  }
  if (data.serviceFee !== undefined && (typeof data.serviceFee !== 'number' || data.serviceFee < 0)) {
    errors.push('Service fee must be a non-negative number')
  }

  // Arrays validation
  if (!Array.isArray(data.amenities)) {
    errors.push('Amenities must be an array')
  }
  if (!Array.isArray(data.images) || data.images.length === 0) {
    errors.push('At least one image is required')
  }

  // Images validation
  if (Array.isArray(data.images)) {
    data.images.forEach((image, index) => {
      if (!image.url || !image.url.startsWith('http')) {
        errors.push(`Image ${index + 1} must have a valid URL`)
      }
    })
  }

  // Business rules validation
  if (data.maxGuests && data.beds && data.maxGuests > data.beds * 2) {
    errors.push('Maximum guests cannot exceed twice the number of beds')
  }

  if (data.minStay !== undefined && data.maxStay !== undefined && data.minStay > data.maxStay) {
    errors.push('Minimum stay cannot be greater than maximum stay')
  }

  // Text length validation
  if (data.title && data.title.trim().length > 100) {
    errors.push('Title cannot exceed 100 characters')
  }
  if (data.description && data.description.trim().length > 2000) {
    errors.push('Description cannot exceed 2000 characters')
  }

  return {
    isValid: errors.length === 0,
    errors,
    data: errors.length === 0 ? data : undefined
  }
}

async function createPropertyHandler(request: NextRequest, user: any, validatedData: CreatePropertyRequestData) {
  try {
    console.log('🏠 Creating property for host:', user.id)

    // Verify user is a host
    if (user.role !== 'HOST') {
      return NextResponse.json(
        {
          success: false,
          error: 'Insufficient permissions',
          message: 'Only hosts can create properties'
        },
        { status: 403 }
      )
    }

    // Create property
    const property = await databasePropertyService.createProperty({
      hostId: user.id,
      title: validatedData.title.trim(),
      description: validatedData.description.trim(),
      type: validatedData.type,
      address: validatedData.address.trim(),
      city: validatedData.city.trim(),
      state: validatedData.state.trim().toUpperCase(),
      zipCode: validatedData.zipCode.replace(/\D/g, ''),
      coordinates: validatedData.coordinates,
      bedrooms: validatedData.bedrooms,
      bathrooms: validatedData.bathrooms,
      beds: validatedData.beds,
      maxGuests: validatedData.maxGuests,
      basePrice: validatedData.basePrice,
      amenities: validatedData.amenities.filter(a => a.trim().length > 0),
      images: validatedData.images.map((img, index) => ({
        url: img.url,
        alt: img.alt || `${validatedData.title} - Image ${index + 1}`
      }))
    })

    if (!property) {
      return NextResponse.json(
        {
          success: false,
          error: 'Creation failed',
          message: 'Failed to create property. Please try again.'
        },
        { status: 500 }
      )
    }

    console.log('✅ Property created successfully:', property.id)

    return NextResponse.json({
      success: true,
      message: 'Property created successfully! It will be reviewed before being published.',
      data: {
        property: {
          id: property.id,
          title: property.name,
          type: property.type,
          status: property.status,
          city: property.location.city,
          state: property.location.state,
          basePrice: property.basePricePerNight,
          images: property.images,
          createdAt: property.createdAt
        }
      }
    }, { status: 201 })

  } catch (error) {
    console.error('❌ Property creation failed:', error)

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
        message: 'An unexpected error occurred while creating the property.'
      },
      { status: 500 }
    )
  }
}

// Apply middleware chain
const handler = withSecurity(
  withCors(
    withRateLimit(
      withAuth(
        withValidation(createPropertyHandler, validateCreatePropertyRequest),
        {
          roles: ['HOST'],
          requireVerification: true
        }
      ),
      {
        maxRequests: 5, // 5 property creations
        windowMs: 60 * 60 * 1000, // per hour
        keyGenerator: (req) => {
          const authHeader = req.headers.get('authorization')
          const token = authHeader?.replace('Bearer ', '') || 'anonymous'
          return `create_property:${token.substring(0, 20)}`
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
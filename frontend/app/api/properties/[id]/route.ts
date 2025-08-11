// API Route: /api/properties/[id]
// Get individual property details (unified for both sources)

import { NextRequest, NextResponse } from 'next/server'
import { unifiedPropertyService, PropertyServiceUtils } from '../../../../lib/services/unified-property-service'

interface RouteContext {
  params: {
    id: string
  }
}

export async function GET(
  request: NextRequest,
  { params }: RouteContext
) {
  const startTime = Date.now()
  const { id } = params

  try {
    console.log(`🏨 API: Getting property details for ${id}`)

    // Validate property ID format
    if (!id || id.length < 3) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_PROPERTY_ID',
          message: 'Property ID is required and must be valid'
        }
      }, { status: 400 })
    }

    // Get property details
    const property = await unifiedPropertyService.getPropertyDetails(id)

    if (!property) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'PROPERTY_NOT_FOUND',
          message: `Property with ID ${id} not found`
        }
      }, { status: 404 })
    }

    // Format property for display
    const formattedProperty = PropertyServiceUtils.formatPropertyForDisplay(property)

    // Get additional computed fields
    const supportsInstantBooking = PropertyServiceUtils.supportsInstantBooking(property)
    const cancellationSummary = PropertyServiceUtils.getCancellationSummary(
      property, 
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
    )

    const processingTime = Date.now() - startTime
    
    return NextResponse.json({
      success: true,
      data: {
        ...formattedProperty,
        computed: {
          supportsInstantBooking,
          cancellationSummary,
          isAvailable: true, // Would check real availability
          nextAvailableDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
          averageStay: 3 // Would calculate from bookings
        },
        // Additional metadata for the property page
        seo: {
          title: `${property.name} - ${property.location.city}, ${property.location.state}`,
          description: property.description,
          image: property.images[0]?.url
        }
      },
      metadata: {
        timestamp: new Date(),
        requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        processingTime,
        source: [property.source]
      }
    })

  } catch (error) {
    console.error(`❌ Property Details API Error for ${id}:`, error)
    
    const processingTime = Date.now() - startTime
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'PROPERTY_FETCH_FAILED',
        message: 'Failed to retrieve property details',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      metadata: {
        timestamp: new Date(),
        requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        processingTime
      }
    }, { status: 500 })
  }
}
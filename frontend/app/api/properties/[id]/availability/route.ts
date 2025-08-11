// API Route: /api/properties/[id]/availability
// Get property availability and rates

import { NextRequest, NextResponse } from 'next/server'
import { unifiedPropertyService, PropertyServiceUtils } from '../../../../../lib/services/unified-property-service'

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
  const { searchParams } = new URL(request.url)

  try {
    console.log(`📅 API: Getting availability for property ${id}`)

    // Parse query parameters
    const checkInStr = searchParams.get('checkin')
    const checkOutStr = searchParams.get('checkout')
    const adults = parseInt(searchParams.get('adults') || '2')
    const children = parseInt(searchParams.get('children') || '0')

    // Validate required parameters
    if (!checkInStr || !checkOutStr) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'MISSING_DATES',
          message: 'Check-in and check-out dates are required'
        }
      }, { status: 400 })
    }

    const checkIn = new Date(checkInStr)
    const checkOut = new Date(checkOutStr)

    // Validate dates
    if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_DATES',
          message: 'Invalid date format. Use YYYY-MM-DD'
        }
      }, { status: 400 })
    }

    if (checkIn >= checkOut) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_DATE_RANGE',
          message: 'Check-out must be after check-in'
        }
      }, { status: 400 })
    }

    if (checkIn < new Date()) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'PAST_DATE',
          message: 'Check-in date must be in the future'
        }
      }, { status: 400 })
    }

    // Calculate nights
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24))

    // Get property details first to determine source
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

    // Get availability data
    const availability = await unifiedPropertyService.getPropertyAvailability(
      id, checkIn, checkOut, adults, children
    )

    if (!availability.length) {
      return NextResponse.json({
        success: true,
        data: {
          available: false,
          message: 'No availability for the selected dates',
          property: {
            id: property.id,
            name: property.name,
            source: property.source
          },
          searchParams: {
            checkIn: checkIn.toISOString(),
            checkOut: checkOut.toISOString(),
            nights,
            adults,
            children
          }
        }
      })
    }

    // Process availability data
    const processedAvailability = availability.map(avail => {
      // Calculate booking fees
      const fees = PropertyServiceUtils.calculateBookingFees(
        avail.basePrice,
        nights,
        property.source,
        'pix' // Default to PIX for calculation
      )

      const feesCredit = PropertyServiceUtils.calculateBookingFees(
        avail.basePrice,
        nights,
        property.source,
        'credit_card'
      )

      return {
        ...avail,
        nights,
        breakdown: {
          basePrice: avail.basePrice,
          basePriceTotal: avail.basePrice * nights,
          taxes: avail.taxes,
          fees: avail.fees,
          discount: avail.discounts,
          totalPrice: avail.totalPrice
        },
        paymentOptions: {
          pix: {
            ...fees,
            savings: fees.discount,
            recommended: true
          },
          creditCard: {
            ...feesCredit,
            installments: nights > 3 ? [
              { months: 1, amount: feesCredit.total, fee: 0 },
              { months: 2, amount: feesCredit.total / 2, fee: 0 },
              { months: 3, amount: feesCredit.total / 3, fee: 0 }
            ] : []
          }
        },
        policies: {
          cancellation: PropertyServiceUtils.getCancellationSummary(property, checkIn),
          instantBooking: PropertyServiceUtils.supportsInstantBooking(property),
          minimumStay: avail.minimumStay,
          maximumStay: avail.maximumStay
        }
      }
    })

    // Find best rate (lowest total price)
    const bestRate = processedAvailability.reduce((prev, current) => 
      prev.totalPrice < current.totalPrice ? prev : current
    )

    const processingTime = Date.now() - startTime

    return NextResponse.json({
      success: true,
      data: {
        available: true,
        property: {
          id: property.id,
          name: property.name,
          source: property.source,
          sourceLabel: property.source === 'local' ? 'Anfitrião Local' : 'Hotel Global'
        },
        searchParams: {
          checkIn: checkIn.toISOString(),
          checkOut: checkOut.toISOString(),
          nights,
          adults,
          children
        },
        rates: processedAvailability,
        bestRate: {
          ...bestRate,
          savings: processedAvailability[0]?.paymentOptions.pix.savings || 0
        },
        summary: {
          totalRates: processedAvailability.length,
          priceRange: {
            min: Math.min(...processedAvailability.map(r => r.totalPrice)),
            max: Math.max(...processedAvailability.map(r => r.totalPrice)),
            currency: processedAvailability[0]?.currency || 'BRL'
          },
          features: {
            instantBooking: PropertyServiceUtils.supportsInstantBooking(property),
            freeCancellation: processedAvailability.some(r => r.freeCancellationUntil),
            freeBreakfast: false, // Would be determined from rate data
            pixDiscount: true
          }
        }
      },
      metadata: {
        timestamp: new Date(),
        requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        processingTime,
        source: [property.source],
        cacheInfo: {
          cached: false, // Would indicate if result was cached
          expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
        }
      }
    })

  } catch (error) {
    console.error(`❌ Availability API Error for ${id}:`, error)
    
    const processingTime = Date.now() - startTime
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'AVAILABILITY_FETCH_FAILED',
        message: 'Failed to retrieve availability information',
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

// POST method for more complex availability requests
export async function POST(
  request: NextRequest,
  { params }: RouteContext
) {
  const startTime = Date.now()
  const { id } = params

  try {
    const body = await request.json()
    
    const {
      checkIn,
      checkOut,
      adults = 2,
      children = 0,
      infants = 0,
      rooms = 1,
      preferences = {}
    } = body

    // Convert to GET format and reuse logic
    const searchParams = new URLSearchParams({
      checkin: checkIn,
      checkout: checkOut,
      adults: adults.toString(),
      children: children.toString()
    })

    const mockRequest = {
      url: `${request.url}?${searchParams.toString()}`
    } as NextRequest

    return GET(mockRequest, { params })

  } catch (error) {
    console.error(`❌ Availability POST API Error for ${id}:`, error)
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'INVALID_REQUEST_BODY',
        message: 'Invalid request body format'
      }
    }, { status: 400 })
  }
}
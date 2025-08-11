// API Route: /api/properties/search
// Unified search endpoint for both local and LiteAPI properties

import { NextRequest, NextResponse } from 'next/server'
import { unifiedPropertyService } from '../../../../lib/services/unified-property-service'
import { SearchFilters, PropertySource } from '../../../../lib/database/schemas'

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    console.log('🔍 POST Search API handler starting...')
    const body = await request.json()
    console.log('📊 Request body parsed:', body)
    
    // Validate and construct search filters
    const filters: SearchFilters = {
      destination: body.destination || '',
      coordinates: body.coordinates,
      checkIn: body.checkIn ? new Date(body.checkIn) : undefined,
      checkOut: body.checkOut ? new Date(body.checkOut) : undefined,
      adults: parseInt(body.adults) || 2,
      children: parseInt(body.children) || 0,
      infants: parseInt(body.infants) || 0,
      propertyTypes: body.propertyTypes,
      minBedrooms: body.minBedrooms ? parseInt(body.minBedrooms) : undefined,
      minBathrooms: body.minBathrooms ? parseInt(body.minBathrooms) : undefined,
      amenities: body.amenities,
      minPrice: body.minPrice ? parseFloat(body.minPrice) : undefined,
      maxPrice: body.maxPrice ? parseFloat(body.maxPrice) : undefined,
      currency: body.currency || 'BRL',
      sources: body.sources,
      includeLocal: body.includeLocal !== false, // Default true
      includeLiteApi: body.includeLiteApi !== false, // Default true
      instantBookable: body.instantBookable,
      freeBreakfast: body.freeBreakfast,
      freeCancellation: body.freeCancellation,
      sortBy: body.sortBy || 'relevance',
      sortOrder: body.sortOrder || 'desc',
      page: parseInt(body.page) || 1,
      limit: Math.min(parseInt(body.limit) || 20, 50) // Max 50 per request
    }

    // Input validation
    if (filters.checkIn && filters.checkOut && filters.checkIn >= filters.checkOut) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_DATES',
          message: 'Check-out must be after check-in date',
        }
      }, { status: 400 })
    }

    if (filters.adults < 1) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_GUESTS',
          message: 'At least 1 adult is required',
        }
      }, { status: 400 })
    }

    // Perform unified search
    console.log(`🔍 API Search Request: ${JSON.stringify(filters)}`)
    
    const searchResponse = await unifiedPropertyService.searchProperties(filters)
    console.log(`🎯 Search response received with ${searchResponse.properties.length} properties`)
    
    // Log search performance
    const processingTime = Date.now() - startTime
    console.log(`✅ Search completed in ${processingTime}ms: ${searchResponse.properties.length}/${searchResponse.totalCount} properties`)

    // Return successful response
    return NextResponse.json({
      success: true,
      data: {
        properties: searchResponse.properties.map((property, index) => {
          console.log(`💰 Property ${index}: ${property.name} - price=${property.basePricePerNight}`)
          
          return {
            ...property,
            // Add computed fields for frontend with safe formatting
            priceFormatted: `R$ ${(property.basePricePerNight || 0).toFixed(2)}`,
            sourceLabel: property.source === PropertySource.LOCAL ? 'Local' : 'Global',
            trustBadge: property.source === PropertySource.LOCAL ? 
              'HospedeFácil Verificado' : 'Parceiro Confiável'
          }
        }),
        pagination: {
          page: searchResponse.page,
          limit: filters.limit,
          totalCount: searchResponse.totalCount,
          totalPages: searchResponse.totalPages,
          hasNext: searchResponse.hasNext,
          hasPrevious: searchResponse.page > 1
        },
        meta: {
          searchTime: searchResponse.searchTime,
          localResults: searchResponse.localResults,
          liteApiResults: searchResponse.liteApiResults,
          searchId: searchResponse.searchId,
          appliedFilters: searchResponse.appliedFilters
        }
      },
      metadata: {
        timestamp: new Date(),
        requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        processingTime,
        source: ['local', 'liteapi'].filter(source => {
          if (source === 'local') return filters.includeLocal
          if (source === 'liteapi') return filters.includeLiteApi
          return true
        })
      }
    })

  } catch (error) {
    console.error('❌ Search API Error:', error)
    
    const processingTime = Date.now() - startTime
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'SEARCH_FAILED',
        message: 'Failed to search properties',
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

// GET method for simple searches (with query parameters)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  
  // Convert query parameters to POST body format
  const body = {
    destination: searchParams.get('destination'),
    checkIn: searchParams.get('checkin'),
    checkOut: searchParams.get('checkout'),
    adults: searchParams.get('adults'),
    children: searchParams.get('children'),
    page: searchParams.get('page'),
    limit: searchParams.get('limit'),
    sortBy: searchParams.get('sort'),
    includeLocal: searchParams.get('include_local') !== 'false',
    includeLiteApi: searchParams.get('include_liteapi') !== 'false'
  }

  // Convert to POST request format and reuse POST logic
  const mockRequest = {
    json: async () => body
  } as NextRequest

  return POST(mockRequest)
}
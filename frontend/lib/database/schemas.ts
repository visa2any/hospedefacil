// Unified Schema for HospedeFácil + LiteAPI Integration

export enum PropertySource {
  LOCAL = 'local',
  LITEAPI = 'liteapi'
}

export enum PropertyType {
  HOTEL = 'hotel',
  APARTMENT = 'apartment',
  HOUSE = 'house',
  CHALET = 'chalet',
  POUSADA = 'pousada',
  VILLA = 'villa',
  RESORT = 'resort'
}

export enum PropertyStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
  SUSPENDED = 'suspended'
}

export enum BookingStatus {
  CONFIRMED = 'confirmed',
  PENDING = 'pending',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
  NO_SHOW = 'no_show'
}

// Base Property Interface - Unified for both sources
export interface UnifiedProperty {
  // Core Identification
  id: string
  source: PropertySource
  externalId?: string // LiteAPI hotel_id or local property ID
  
  // Basic Info
  name: string
  description: string
  type: PropertyType
  status: PropertyStatus
  
  // Location
  location: {
    address: string
    city: string
    state: string
    country: string
    zipCode: string
    coordinates: {
      lat: number
      lng: number
    }
    timezone?: string
  }
  
  // Media
  images: PropertyImage[]
  virtualTour?: string
  
  // Accommodation Details
  accommodates: number
  bedrooms: number
  bathrooms: number
  beds: number
  
  // Amenities (unified list)
  amenities: string[]
  
  // Pricing (for display/cache)
  basePricePerNight: number
  currency: string
  taxesIncluded: boolean
  
  // Ratings & Reviews
  rating: number
  reviewCount: number
  
  // Availability 
  isInstantBookable: boolean
  minimumStay: number
  maximumStay?: number
  
  // House Rules
  checkInTime: string
  checkOutTime: string
  houseRules: string[]
  
  // Cancellation Policy
  cancellationPolicy: CancellationPolicy
  
  // Source-specific data
  localData?: LocalPropertyData
  liteApiData?: LiteApiPropertyData
  
  // Metadata
  createdAt: Date
  updatedAt: Date
  lastSyncedAt?: Date // For LiteAPI properties
}

// Local Properties (Host-owned)
export interface LocalPropertyData {
  hostId: string
  hostName: string
  hostPhone: string
  hostEmail: string
  hostAvatar?: string
  isSuperhost: boolean
  
  // Verification
  isVerified: boolean
  verifiedDocuments: string[]
  
  // Financials
  commissionRate: number // 9-15%
  payoutMethod: 'pix' | 'bank_transfer'
  payoutDetails: any
  
  // Performance
  responseRate: number
  responseTime: number // in minutes
  acceptanceRate: number
  
  // Custom settings
  customSettings: {
    allowPets: boolean
    allowSmoking: boolean
    allowParties: boolean
    wifi: boolean
    parking: boolean
    [key: string]: any
  }
}

// LiteAPI Properties
export interface LiteApiPropertyData {
  // LiteAPI specific fields
  hotelId: string
  chainId?: string
  chainName?: string
  
  // Content from LiteAPI
  contentSource: 'supplier' | 'liteapi'
  lastContentUpdate: Date
  
  // Pricing & Availability
  supplierMarkup: number // Our markup percentage
  baseCurrency: string
  rateType: 'net' | 'commission'
  
  // Booking info
  bookingRules: {
    paymentDeadline: number // hours
    cancellationDeadline: number // hours
    childPolicy?: string
    petPolicy?: string
  }
  
  // Provider info
  provider: string
  providerRating?: number
  
  // Sync metadata
  syncFrequency: 'realtime' | 'hourly' | 'daily'
  lastPriceUpdate: Date
  lastAvailabilityUpdate: Date
}

export interface PropertyImage {
  id: string
  url: string
  alt: string
  order: number
  type: 'main' | 'bedroom' | 'bathroom' | 'kitchen' | 'exterior' | 'other'
  source?: 'local' | 'liteapi'
  width?: number
  height?: number
}

export interface CancellationPolicy {
  type: 'flexible' | 'moderate' | 'strict' | 'super_strict' | 'custom'
  description: string
  rules: CancellationRule[]
}

export interface CancellationRule {
  beforeHours: number
  refundPercentage: number
  penalty?: number
}

// Unified Booking Model
export interface UnifiedBooking {
  // Core identification
  id: string
  bookingNumber: string
  source: PropertySource
  externalBookingId?: string // For LiteAPI bookings
  
  // Property & Guest
  propertyId: string
  property: UnifiedProperty
  guestId: string
  guest: Guest
  
  // Stay details
  checkIn: Date
  checkOut: Date
  nights: number
  guests: number
  
  // Pricing breakdown
  basePrice: number
  taxes: number
  fees: number
  discount: number
  totalPrice: number
  currency: string
  
  // Payment
  paymentMethod: 'pix' | 'credit_card' | 'wallet'
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded'
  paymentDetails?: any
  
  // Commission (different for each source)
  commissionRate: number
  commissionAmount: number
  netAmount: number // Amount after commission
  
  // Status & Timeline
  status: BookingStatus
  createdAt: Date
  updatedAt: Date
  confirmedAt?: Date
  cancelledAt?: Date
  
  // Special requests
  specialRequests?: string
  
  // Source-specific data
  localBookingData?: LocalBookingData
  liteApiBookingData?: LiteApiBookingData
  
  // Communication
  messages: BookingMessage[]
  
  // Check-in info
  checkInInstructions?: string
  accessCodes?: any
}

export interface LocalBookingData {
  hostId: string
  hostApprovalRequired: boolean
  hostApprovedAt?: Date
  
  // Local payment processing
  pixKey?: string
  pixQrCode?: string
  pixExpiresAt?: Date
  
  // Host communication
  hostNotified: boolean
  guestNotified: boolean
  
  // Check-in details
  keyLocation?: string
  wifiPassword?: string
  localContact?: string
}

export interface LiteApiBookingData {
  // LiteAPI booking flow
  prebookId?: string
  bookingId: string
  hotelConfirmationNumber?: string
  
  // Provider details
  provider: string
  rateKey: string
  
  // Payment to supplier
  supplierPrice: number
  supplierCurrency: string
  markupApplied: number
  
  // Booking rules from supplier
  freeBreakfast?: boolean
  freeCancellation?: boolean
  nonRefundable?: boolean
  
  // Supplier communication
  supplierStatus: 'confirmed' | 'on_request' | 'cancelled'
  supplierNotifications: any[]
}

export interface Guest {
  id: string
  name: string
  email: string
  phone: string
  cpf?: string
  nationality?: string
  dateOfBirth?: Date
  
  // Preferences
  preferences: {
    language: string
    currency: string
    dietaryRestrictions?: string[]
    accessibility?: string[]
  }
  
  // History
  totalBookings: number
  totalSpent: number
  averageRating: number
  isVerified: boolean
  
  // Metadata
  createdAt: Date
  lastBookingAt?: Date
}

export interface BookingMessage {
  id: string
  bookingId: string
  fromType: 'guest' | 'host' | 'system' | 'support'
  fromId?: string
  fromName: string
  message: string
  attachments?: string[]
  createdAt: Date
  readAt?: Date
}

// Search & Filtering
export interface SearchFilters {
  // Location
  destination?: string
  coordinates?: { lat: number; lng: number; radius: number }
  
  // Dates
  checkIn?: Date
  checkOut?: Date
  
  // Guests
  adults: number
  children: number
  infants: number
  
  // Property preferences
  propertyTypes?: PropertyType[]
  minBedrooms?: number
  minBathrooms?: number
  
  // Amenities
  amenities?: string[]
  
  // Price range
  minPrice?: number
  maxPrice?: number
  currency: string
  
  // Source preference
  sources?: PropertySource[]
  includeLocal?: boolean
  includeLiteApi?: boolean
  
  // Booking preferences
  instantBookable?: boolean
  freeBreakfast?: boolean
  freeCancellation?: boolean
  
  // Sorting
  sortBy?: 'price' | 'rating' | 'distance' | 'popularity'
  sortOrder?: 'asc' | 'desc'
  
  // Pagination
  page: number
  limit: number
}

export interface SearchResponse {
  properties: UnifiedProperty[]
  totalCount: number
  page: number
  totalPages: number
  hasNext: boolean
  
  // Performance metrics
  searchTime: number
  localResults: number
  liteApiResults: number
  
  // Filters applied
  appliedFilters: SearchFilters
  
  // Metadata
  searchId: string
  timestamp: Date
}

// Pricing & Availability
export interface PropertyAvailability {
  propertyId: string
  source: PropertySource
  
  // Date range
  checkIn: Date
  checkOut: Date
  
  // Availability
  isAvailable: boolean
  availableRooms?: number
  lastRoomWarning?: boolean
  
  // Pricing
  basePrice: number
  taxes: number
  fees: number
  discounts: number
  totalPrice: number
  currency: string
  
  // Rate details
  rateId: string
  rateType: 'standard' | 'non_refundable' | 'advance_purchase' | 'special'
  rateDescription?: string
  
  // Restrictions
  minimumStay: number
  maximumStay?: number
  
  // Cancellation
  freeCancellationUntil?: Date
  cancellationFee?: number
  
  // Special offers
  promotions?: Promotion[]
  
  // Cache info
  cachedAt: Date
  expiresAt: Date
}

export interface Promotion {
  id: string
  type: 'early_bird' | 'last_minute' | 'weekly_discount' | 'monthly_discount' | 'first_booking'
  name: string
  description: string
  discountType: 'percentage' | 'fixed'
  discountValue: number
  validFrom: Date
  validTo: Date
  minimumStay?: number
  maximumStay?: number
}

// Cache Models
export interface CacheEntry {
  key: string
  value: any
  type: 'search' | 'property' | 'availability' | 'rates' | 'static'
  source?: PropertySource
  createdAt: Date
  expiresAt: Date
  accessCount: number
  lastAccessedAt: Date
}

// Analytics & Metrics
export interface PropertyMetrics {
  propertyId: string
  source: PropertySource
  
  // Performance metrics
  views: number
  clicks: number
  bookings: number
  revenue: number
  
  // Time-based metrics
  date: Date
  period: 'daily' | 'weekly' | 'monthly'
  
  // Conversion metrics
  viewToClick: number
  clickToBooking: number
  averageBookingValue: number
  
  // Source comparison
  searchRanking: number
  competitorComparison?: any
}

// System Configuration
export interface SystemConfig {
  // LiteAPI settings
  liteApi: {
    enabled: boolean
    apiKey: string
    baseUrl: string
    timeout: number
    rateLimit: number
    defaultMarkup: number
    cacheTtl: number
  }
  
  // Commission rates
  commissions: {
    local: {
      standard: number
      superhost: number
      volume_tiers: { bookings: number; rate: number }[]
    }
    liteApi: {
      hotel: number
      apartment: number
      resort: number
      default: number
    }
  }
  
  // Cache configuration
  cache: {
    redis: {
      host: string
      port: number
      password?: string
      db: number
    }
    ttl: {
      search: number
      property: number
      availability: number
      rates: number
    }
  }
  
  // Feature flags
  features: {
    enableLiteApi: boolean
    enableLocalProperties: boolean
    enableDynamicPricing: boolean
    enableRealTimeSync: boolean
  }
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: any
  }
  metadata?: {
    timestamp: Date
    requestId: string
    processingTime: number
    source?: PropertySource[]
  }
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number
    limit: number
    totalCount: number
    totalPages: number
    hasNext: boolean
    hasPrevious: boolean
  }
}

// Webhook Types
export interface WebhookEvent {
  id: string
  type: 'booking.created' | 'booking.cancelled' | 'property.updated' | 'availability.changed'
  source: PropertySource
  data: any
  timestamp: Date
  processed: boolean
  processedAt?: Date
}
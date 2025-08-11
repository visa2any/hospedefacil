// System Configuration for HospedeFácil + LiteAPI Integration
// Centralized configuration management

export const SYSTEM_CONFIG = {
  // Application Info
  app: {
    name: 'HospedeFácil',
    version: '2.0.0',
    environment: process.env.NODE_ENV || 'development',
    baseUrl: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  },

  // LiteAPI Integration
  liteApi: {
    enabled: process.env.NEXT_PUBLIC_ENABLE_LITEAPI === 'true',
    apiKey: process.env.LITEAPI_KEY || '',
    baseUrl: process.env.LITEAPI_BASE_URL || 'https://api.liteapi.travel',
    version: 'v1.0',
    timeout: 30000,
    maxRetries: 3,
    rateLimit: {
      requestsPerHour: 5000,
      requestsPerDay: 50000,
      burstLimit: 100
    },
    defaultMarkup: parseFloat(process.env.LITEAPI_DEFAULT_MARKUP || '15'),
    cacheTtl: {
      search: 10 * 60, // 10 minutes
      properties: 60 * 60, // 1 hour
      rates: 5 * 60, // 5 minutes
      availability: 5 * 60 // 5 minutes
    },
    features: {
      realTimeSync: true,
      dynamicPricing: true,
      webhooks: false // To be implemented
    }
  },

  // Local Properties Configuration
  local: {
    enabled: process.env.NEXT_PUBLIC_ENABLE_LOCAL === 'true' || true,
    defaultCommissionRate: 0.12, // 12%
    superhostCommissionRate: 0.09, // 9%
    features: {
      instantBooking: true,
      hostVerification: true,
      superhostProgram: true,
      directMessaging: true
    },
    payoutSchedule: {
      standard: 2, // 2 business days
      superhost: 1 // 1 business day
    }
  },

  // Commission Structure
  commissions: {
    local: {
      standard: 0.12, // 12%
      superhost: 0.09, // 9%
      volumeTiers: [
        { bookingsPerMonth: 10, rate: 0.11 },
        { bookingsPerMonth: 25, rate: 0.10 },
        { bookingsPerMonth: 50, rate: 0.09 }
      ]
    },
    liteApi: {
      hotel: 0.15, // 15%
      apartment: 0.18, // 18%
      resort: 0.20, // 20%
      villa: 0.16, // 16%
      default: 0.15 // 15%
    },
    seasonalAdjustments: {
      peak: 1.1, // +10% during peak season
      shoulder: 1.0, // No adjustment
      low: 0.9 // -10% during low season
    }
  },

  // Payment Configuration
  payments: {
    pix: {
      enabled: process.env.NEXT_PUBLIC_ENABLE_PIX === 'true',
      key: process.env.NEXT_PUBLIC_PIX_KEY || 'hospedefacil@pix.com.br',
      discount: 0.03, // 3% discount for PIX
      expiryMinutes: 30
    },
    creditCard: {
      enabled: true,
      maxInstallments: 12,
      feeThreshold: 1000, // R$ 1000 minimum for installments
      processors: ['mercadopago', 'pagarme', 'stripe']
    },
    corporateWallet: {
      enabled: true,
      liteApiWallet: true,
      minimumBalance: 10000, // R$ 10,000
      autoRecharge: true
    }
  },

  // Cache Configuration
  cache: {
    enabled: true,
    layers: ['memory', 'redis'],
    memory: {
      maxSize: 1000,
      defaultTtl: 5 * 60 * 1000 // 5 minutes in milliseconds
    },
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: 0,
      defaultTtl: 30 * 60, // 30 minutes in seconds
      cluster: process.env.REDIS_CLUSTER === 'true'
    },
    ttl: {
      search: 10 * 60,      // 10 minutes
      property: 60 * 60,    // 1 hour
      availability: 5 * 60,  // 5 minutes
      rates: 10 * 60,      // 10 minutes
      images: 24 * 60 * 60, // 24 hours
      static: 7 * 24 * 60 * 60 // 1 week
    },
    warmup: {
      enabled: true,
      popularDestinations: [
        'Rio de Janeiro', 'São Paulo', 'Florianópolis', 
        'Salvador', 'Fortaleza', 'Gramado'
      ],
      scheduleHour: 6 // 6 AM daily warmup
    }
  },

  // Database Configuration
  database: {
    primary: {
      url: process.env.DATABASE_URL || 'postgresql://localhost/hospedefacil',
      maxConnections: 20,
      timeout: 30000
    },
    replica: {
      url: process.env.DATABASE_REPLICA_URL,
      maxConnections: 10,
      readOnly: true
    },
    migrations: {
      autoRun: process.env.NODE_ENV === 'production',
      directory: './migrations'
    }
  },

  // Search Configuration
  search: {
    maxResults: 50,
    defaultLimit: 20,
    timeout: 10000, // 10 seconds
    sources: {
      local: {
        weight: 1.2, // Prioritize local properties
        timeout: 2000
      },
      liteApi: {
        weight: 1.0,
        timeout: 8000
      }
    },
    sorting: {
      default: 'relevance',
      options: ['relevance', 'price', 'rating', 'distance', 'popularity']
    },
    filters: {
      maxPrice: 10000, // R$ 10,000 per night
      maxGuests: 16,
      maxPropertyTypes: 10
    }
  },

  // Booking Configuration
  booking: {
    confirmation: {
      instantLocal: true,
      liteApiTimeout: 300000, // 5 minutes
      maxRetries: 3
    },
    cancellation: {
      freeHours: 48, // 48 hours free cancellation
      penaltyTiers: [
        { hoursBefore: 24, penalty: 0.5 },
        { hoursBefore: 12, penalty: 0.8 },
        { hoursBefore: 0, penalty: 1.0 }
      ]
    },
    payment: {
      holdDuration: 24 * 60 * 60 * 1000, // 24 hours
      autoRelease: true,
      failureRetries: 3
    }
  },

  // Communication Configuration
  communication: {
    email: {
      provider: 'sendgrid',
      apiKey: process.env.SENDGRID_API_KEY,
      fromAddress: 'reservas@hospedefacil.com.br',
      replyTo: 'suporte@hospedefacil.com.br'
    },
    sms: {
      provider: 'twilio',
      enabled: true,
      booking: true,
      reminders: true
    },
    whatsapp: {
      enabled: process.env.NEXT_PUBLIC_ENABLE_WHATSAPP === 'true',
      supportNumber: process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT || '+5511999999999',
      businessNumber: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '+5511999999999',
      apiKey: process.env.WHATSAPP_API_KEY
    },
    push: {
      enabled: false, // To be implemented
      vapidKey: process.env.VAPID_KEY
    }
  },

  // Analytics Configuration
  analytics: {
    google: {
      enabled: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS !== 'false',
      measurementId: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
      enhanced: true
    },
    mixpanel: {
      enabled: false,
      projectToken: process.env.MIXPANEL_PROJECT_TOKEN
    },
    custom: {
      enabled: true,
      endpoint: '/api/analytics/track',
      batchSize: 50,
      flushInterval: 30000 // 30 seconds
    }
  },

  // Security Configuration
  security: {
    jwt: {
      secret: process.env.JWT_SECRET || 'your-super-secret-key',
      expiresIn: '7d',
      refreshExpiresIn: '30d'
    },
    rateLimit: {
      enabled: true,
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 1000, // per IP
      skipSuccessfulRequests: false
    },
    cors: {
      origins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true
    },
    encryption: {
      algorithm: 'aes-256-gcm',
      key: process.env.ENCRYPTION_KEY
    }
  },

  // Monitoring Configuration
  monitoring: {
    healthCheck: {
      enabled: true,
      interval: 60000, // 1 minute
      endpoints: ['/api/health', '/api/liteapi/health']
    },
    logging: {
      level: process.env.LOG_LEVEL || 'info',
      format: 'json',
      destinations: ['console', 'file'],
      retention: '30d'
    },
    metrics: {
      enabled: true,
      prometheus: false, // To be implemented
      interval: 30000 // 30 seconds
    },
    alerts: {
      enabled: true,
      channels: ['email', 'slack'],
      thresholds: {
        errorRate: 0.05, // 5%
        responseTime: 5000, // 5 seconds
        availability: 0.99 // 99%
      }
    }
  },

  // Feature Flags
  features: {
    enableLiteApi: process.env.NEXT_PUBLIC_ENABLE_LITEAPI !== 'false',
    enableLocalProperties: process.env.NEXT_PUBLIC_ENABLE_LOCAL !== 'false',
    enableDynamicPricing: process.env.ENABLE_DYNAMIC_PRICING === 'true',
    enableRealTimeSync: process.env.ENABLE_REALTIME_SYNC === 'true',
    enableAI: false, // To be implemented
    enableBlockchain: false, // Future feature
    enableVR: false, // Future feature
    betaFeatures: process.env.ENABLE_BETA === 'true'
  },

  // Business Rules
  business: {
    seasons: {
      peak: ['12', '01', '02', '07'], // December, January, February, July
      shoulder: ['03', '04', '05', '06', '08', '09'],
      low: ['10', '11']
    },
    minimumStay: {
      default: 1,
      peak: 2,
      weekend: 2
    },
    maximumStay: {
      default: 30,
      extended: 90
    },
    advanceBooking: {
      minimum: 2, // hours
      maximum: 365 // days
    },
    ageRestrictions: {
      minimumAge: 18,
      accompaniedMinor: 16
    }
  },

  // Localization
  localization: {
    defaultLocale: 'pt-BR',
    supportedLocales: ['pt-BR', 'en-US', 'es-ES'],
    currency: {
      default: 'BRL',
      supported: ['BRL', 'USD', 'EUR']
    },
    timezone: 'America/Sao_Paulo',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: 'HH:mm'
  },

  // Development Configuration
  development: {
    mockData: process.env.NODE_ENV === 'development',
    debugLogging: process.env.DEBUG === 'true',
    hotReload: true,
    sourceMaps: true,
    profiling: process.env.ENABLE_PROFILING === 'true'
  }
} as const

// Configuration validation
export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Required environment variables
  const required = [
    'DATABASE_URL',
    'JWT_SECRET',
    'NEXT_PUBLIC_SITE_URL'
  ]

  // Optional but recommended for LiteAPI
  if (SYSTEM_CONFIG.liteApi.enabled) {
    required.push('LITEAPI_KEY')
  }

  for (const key of required) {
    if (!process.env[key]) {
      errors.push(`Missing required environment variable: ${key}`)
    }
  }

  // Validate commission rates
  if (SYSTEM_CONFIG.commissions.local.standard < 0 || SYSTEM_CONFIG.commissions.local.standard > 1) {
    errors.push('Local commission rate must be between 0 and 1')
  }

  // Validate cache TTL values
  if (SYSTEM_CONFIG.cache.ttl.search < 60) {
    errors.push('Search cache TTL should be at least 60 seconds')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

// Get configuration for specific environment
export function getEnvironmentConfig() {
  const env = SYSTEM_CONFIG.app.environment
  
  return {
    ...SYSTEM_CONFIG,
    // Environment-specific overrides
    ...(env === 'production' && {
      development: {
        mockData: false,
        debugLogging: false,
        hotReload: false,
        sourceMaps: false,
        profiling: false
      }
    }),
    ...(env === 'test' && {
      cache: {
        ...SYSTEM_CONFIG.cache,
        enabled: false
      },
      analytics: {
        ...SYSTEM_CONFIG.analytics,
        google: { enabled: false },
        custom: { enabled: false }
      }
    })
  }
}

// Export configuration helper functions
export const ConfigUtils = {
  // Check if feature is enabled
  isFeatureEnabled: (feature: keyof typeof SYSTEM_CONFIG.features): boolean => {
    return SYSTEM_CONFIG.features[feature] === true
  },

  // Get commission rate for property type and source
  getCommissionRate: (source: 'local' | 'liteApi', propertyType?: string, isSuperhosts?: boolean): number => {
    if (source === 'local') {
      if (isSuperhosts) return SYSTEM_CONFIG.commissions.local.superhost
      return SYSTEM_CONFIG.commissions.local.standard
    } else {
      const rates = SYSTEM_CONFIG.commissions.liteApi
      return rates[propertyType as keyof typeof rates] || rates.default
    }
  },

  // Get cache TTL for data type
  getCacheTTL: (type: keyof typeof SYSTEM_CONFIG.cache.ttl): number => {
    return SYSTEM_CONFIG.cache.ttl[type]
  },

  // Check if in peak season
  isPeakSeason: (date: Date = new Date()): boolean => {
    const month = date.getMonth() + 1 // JavaScript months are 0-indexed
    return SYSTEM_CONFIG.business.seasons.peak.includes(month.toString().padStart(2, '0') as any)
  },

  // Get seasonal multiplier
  getSeasonalMultiplier: (date: Date = new Date()): number => {
    const month = date.getMonth() + 1
    const monthStr = month.toString().padStart(2, '0')
    
    if (SYSTEM_CONFIG.business.seasons.peak.includes(monthStr as any)) {
      return SYSTEM_CONFIG.commissions.seasonalAdjustments.peak
    } else if (SYSTEM_CONFIG.business.seasons.low.includes(monthStr as any)) {
      return SYSTEM_CONFIG.commissions.seasonalAdjustments.low
    } else {
      return SYSTEM_CONFIG.commissions.seasonalAdjustments.shoulder
    }
  }
}

// Export the main configuration
export default SYSTEM_CONFIG
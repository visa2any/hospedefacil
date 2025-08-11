import { z } from 'zod'

// Environment schema validation
const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.string().transform(Number).default('3001'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  
  // Database
  DATABASE_URL: z.string().url(),
  
  // Redis
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  
  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),
  
  // File Upload
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  
  // Email
  SMTP_HOST: z.string().default('smtp.gmail.com'),
  SMTP_PORT: z.string().transform(Number).default('587'),
  SMTP_USER: z.string().email().optional(),
  SMTP_PASSWORD: z.string().optional(),
  
  // OpenAI
  OPENAI_API_KEY: z.string().startsWith('sk-').optional(),
  
  // WhatsApp
  WHATSAPP_SESSION_PATH: z.string().default('./whatsapp-session'),
  WHATSAPP_WEBHOOK_URL: z.string().url().optional(),
  
  // PIX Payment
  PIX_CLIENT_ID: z.string().optional(),
  PIX_CLIENT_SECRET: z.string().optional(),
  PIX_CERTIFICATE_PATH: z.string().optional(),
  PIX_CERTIFICATE_PASSWORD: z.string().optional(),
  
  // Brazilian APIs
  RECEITA_FEDERAL_API_KEY: z.string().optional(),
  VIACEP_API_URL: z.string().url().default('https://viacep.com.br/ws'),
  
  // Maps
  GOOGLE_MAPS_API_KEY: z.string().optional(),
  
  // Monitoring
  SENTRY_DSN: z.string().url().optional(),
  DATADOG_API_KEY: z.string().optional(),
  
  // Rate Limiting
  RATE_LIMIT_MAX: z.string().transform(Number).default('100'),
  RATE_LIMIT_WINDOW: z.string().transform(Number).default('60000'),
  
  // Security
  BCRYPT_ROUNDS: z.string().transform(Number).default('12'),
  SESSION_SECRET: z.string().min(32).optional(),
})

// Load and validate environment variables
function loadEnvironment() {
  try {
    return envSchema.parse(process.env)
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map(err => err.path.join('.'))
      console.error('❌ Variáveis de ambiente inválidas ou ausentes:')
      console.error('Missing variables:', missingVars)
      
      // Show example .env for missing variables
      console.log('\n📝 Adicione estas variáveis ao seu arquivo .env:')
      for (const variable of missingVars) {
        const key = variable.toUpperCase()
        console.log(`${key}=your_${key.toLowerCase()}_value`)
      }
    }
    
    process.exit(1)
  }
}

export const config = loadEnvironment()

// Environment-specific configurations
export const isDevelopment = config.NODE_ENV === 'development'
export const isProduction = config.NODE_ENV === 'production'
export const isStaging = config.NODE_ENV === 'staging'

// Feature flags based on environment
export const features = {
  enableSwaggerDocs: isDevelopment || isStaging,
  enableDetailedLogs: isDevelopment,
  enableRateLimiting: isProduction || isStaging,
  enableCaching: true,
  enableAnalytics: isProduction,
  enableErrorTracking: isProduction || isStaging,
}

// API Configuration
export const api = {
  version: '1.0.0',
  name: 'HospedeFácil API',
  description: 'API da plataforma de hospedagem mais avançada do Brasil',
  baseUrl: `http://localhost:${config.PORT}`,
  docsPath: '/docs',
  healthPath: '/health',
}

// Business rules
export const business = {
  // Booking rules
  minBookingDays: 1,
  maxBookingDays: 90,
  cancellationWindowHours: 24,
  autoAcceptBookings: false,
  
  // Pricing
  platformFeePercent: 0.10, // 10%
  hostFeePercent: 0.03,     // 3%
  taxPercent: 0.08,         // 8% (approx Brazilian tax)
  
  // Payments
  pixTimeoutMinutes: 30,
  refundProcessingDays: 7,
  payoutDays: 1,
  
  // Reviews
  reviewWindowDays: 14,
  minRatingStars: 1,
  maxRatingStars: 5,
  
  // Search
  maxSearchResults: 100,
  searchRadiusKm: 50,
  
  // Files
  maxImageSize: 10 * 1024 * 1024, // 10MB
  maxImages: 20,
  allowedImageTypes: ['image/jpeg', 'image/png', 'image/webp'],
  
  // Rate limiting
  maxRequestsPerMinute: 100,
  maxAuthAttempts: 5,
  authLockoutMinutes: 15,
}

// Brazilian specific configurations
export const brazil = {
  currency: 'BRL',
  locale: 'pt-BR',
  timezone: 'America/Sao_Paulo',
  country: 'BR',
  
  // Document validation
  cpfRegex: /^\d{3}\.\d{3}\.\d{3}-\d{2}$/,
  cnpjRegex: /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/,
  cepRegex: /^\d{5}-\d{3}$/,
  phoneRegex: /^\(\d{2}\)\s\d{4,5}-\d{4}$/,
  
  // PIX key types
  pixKeyTypes: ['cpf', 'cnpj', 'email', 'phone', 'random'],
  
  // States
  states: [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
    'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
    'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
  ],
  
  // Brazilian holidays (major ones that affect pricing)
  holidays: [
    'new-year', 'carnival', 'easter', 'tiradentes', 'labor-day',
    'independence', 'nossa-senhora', 'finados', 'proclamacao', 'christmas'
  ]
}

// AI Configuration
export const ai = {
  openai: {
    model: 'gpt-4-turbo-preview',
    maxTokens: 2000,
    temperature: 0.7,
    systemPrompt: `Você é um assistente de hospedagem brasileiro especializado em turismo no Brasil. 
    Fale sempre em português brasileiro, seja prestativo e conhecedor das regiões turísticas do país.
    Ajude os usuários com informações sobre hospedagens, destinos e experiências de viagem.`,
  },
  
  // Features
  enableChatbot: true,
  enablePropertyDescriptions: true,
  enablePricingOptimization: true,
  enableReviewAnalysis: true,
  enableFraudDetection: true,
}

// Integrations
export const integrations = {
  whatsapp: {
    enabled: !!config.WHATSAPP_SESSION_PATH,
    businessHours: {
      start: '08:00',
      end: '22:00',
      timezone: brazil.timezone,
    }
  },
  
  pix: {
    enabled: !!(config.PIX_CLIENT_ID && config.PIX_CLIENT_SECRET),
    timeout: 30 * 60 * 1000, // 30 minutes
  },
  
  maps: {
    enabled: !!config.GOOGLE_MAPS_API_KEY,
    defaultZoom: 15,
    defaultCenter: { lat: -23.5505, lng: -46.6333 }, // São Paulo
  },
  
  cloudinary: {
    enabled: !!(config.CLOUDINARY_CLOUD_NAME && config.CLOUDINARY_API_KEY),
    folder: 'hospedefacil',
    transformations: {
      thumbnail: 'w_300,h_200,c_fill,q_auto',
      medium: 'w_800,h_600,c_fill,q_auto',
      large: 'w_1200,h_800,c_fill,q_auto',
    }
  }
}

// Export everything
export default config
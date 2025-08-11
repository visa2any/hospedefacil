import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import jwt from '@fastify/jwt'
import rateLimit from '@fastify/rate-limit'
import multipart from '@fastify/multipart'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import { Server } from 'socket.io'

import { config } from '@/config/environment.js'
import { prisma } from '@/config/database.js'
import { redisClient } from '@/config/redis.js'

// Routes
import { authRoutes } from '@/routes/auth.js'
import { propertyRoutes } from '@/routes/properties.js'
import { bookingRoutes } from '@/routes/bookings.js'
import { userRoutes } from '@/routes/users.js'
import { searchRoutes } from '@/routes/search.js'
import { paymentRoutes } from '@/routes/payments.js'
import { webhookRoutes } from '@/routes/webhooks.js'
import { aiRoutes } from '@/routes/ai.js'
import { adminRoutes } from '@/routes/admin.js'

// Middleware
import { errorHandler } from '@/middleware/error-handler.js'
import { authMiddleware } from '@/middleware/auth.js'

const fastify = Fastify({
  logger: {
    level: config.NODE_ENV === 'production' ? 'warn' : 'info',
    prettyPrint: config.NODE_ENV === 'development',
  }
})

async function startServer() {
  try {
    // Security & CORS
    await fastify.register(helmet, {
      contentSecurityPolicy: config.NODE_ENV === 'production',
    })

    await fastify.register(cors, {
      origin: config.CORS_ORIGIN.split(','),
      credentials: true,
    })

    // Rate limiting
    await fastify.register(rateLimit, {
      max: config.RATE_LIMIT_MAX,
      timeWindow: config.RATE_LIMIT_WINDOW,
      redis: redisClient,
    })

    // JWT
    await fastify.register(jwt, {
      secret: config.JWT_SECRET,
      sign: { expiresIn: config.JWT_EXPIRES_IN },
    })

    // File upload
    await fastify.register(multipart, {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      }
    })

    // API Documentation
    if (config.NODE_ENV === 'development') {
      await fastify.register(swagger, {
        swagger: {
          info: {
            title: 'HospedeFácil API',
            description: 'API da plataforma de hospedagem mais avançada do Brasil',
            version: '1.0.0',
          },
          host: `localhost:${config.PORT}`,
          schemes: ['http', 'https'],
          consumes: ['application/json', 'multipart/form-data'],
          produces: ['application/json'],
          securityDefinitions: {
            Bearer: {
              type: 'apiKey',
              name: 'Authorization',
              in: 'header',
            },
          },
        },
      })

      await fastify.register(swaggerUi, {
        routePrefix: '/docs',
        uiConfig: {
          docExpansion: 'full',
          deepLinking: false,
        },
        staticCSP: true,
        transformSpecificationClone: true,
      })
    }

    // Health check
    fastify.get('/health', async () => {
      try {
        await prisma.$queryRaw`SELECT 1`
        await redisClient.ping()
        
        return {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          services: {
            database: 'connected',
            redis: 'connected',
          }
        }
      } catch (error) {
        fastify.log.error('Health check failed:', error)
        return {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: 'Service unavailable'
        }
      }
    })

    // Register middleware
    fastify.register(authMiddleware)
    fastify.setErrorHandler(errorHandler)

    // Register routes
    await fastify.register(authRoutes, { prefix: '/api/auth' })
    await fastify.register(propertyRoutes, { prefix: '/api/properties' })
    await fastify.register(bookingRoutes, { prefix: '/api/bookings' })
    await fastify.register(userRoutes, { prefix: '/api/users' })
    await fastify.register(searchRoutes, { prefix: '/api/search' })
    await fastify.register(paymentRoutes, { prefix: '/api/payments' })
    await fastify.register(webhookRoutes, { prefix: '/api/webhooks' })
    await fastify.register(aiRoutes, { prefix: '/api/ai' })
    await fastify.register(adminRoutes, { prefix: '/api/admin' })

    // Socket.IO for real-time features
    const io = new Server(fastify.server, {
      cors: {
        origin: config.CORS_ORIGIN.split(','),
        methods: ['GET', 'POST'],
        credentials: true,
      }
    })

    io.on('connection', (socket) => {
      fastify.log.info(`Socket connected: ${socket.id}`)

      // Join user room for personal notifications
      socket.on('join-user-room', (userId: string) => {
        socket.join(`user:${userId}`)
      })

      // Join property room for real-time updates
      socket.on('join-property-room', (propertyId: string) => {
        socket.join(`property:${propertyId}`)
      })

      socket.on('disconnect', () => {
        fastify.log.info(`Socket disconnected: ${socket.id}`)
      })
    })

    // Store io instance for use in routes
    fastify.decorate('io', io)

    // Start server
    await fastify.listen({
      port: config.PORT,
      host: '0.0.0.0',
    })

    fastify.log.info(`🚀 HospedeFácil API rodando na porta ${config.PORT}`)
    
    if (config.NODE_ENV === 'development') {
      fastify.log.info(`📚 Documentação disponível em: http://localhost:${config.PORT}/docs`)
    }

  } catch (error) {
    fastify.log.error('Erro ao iniciar servidor:', error)
    process.exit(1)
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  fastify.log.info('Encerrando servidor...')
  
  try {
    await fastify.close()
    await prisma.$disconnect()
    await redisClient.quit()
    process.exit(0)
  } catch (error) {
    fastify.log.error('Erro ao encerrar servidor:', error)
    process.exit(1)
  }
})

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  fastify.log.fatal('Uncaught Exception:', error)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  fastify.log.fatal('Unhandled Rejection at:', promise, 'reason:', reason)
  process.exit(1)
})

startServer()

export { fastify }
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import fp from 'fastify-plugin'
import { prisma } from '@/config/database.js'
import { cacheService } from '@/config/redis.js'
import { z } from 'zod'

// JWT payload schema
const jwtPayloadSchema = z.object({
  userId: z.string(),
  role: z.enum(['GUEST', 'HOST', 'ADMIN']),
  iat: z.number(),
  exp: z.number(),
})

// Extend Fastify types
declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string
      email: string
      name: string
      role: 'GUEST' | 'HOST' | 'ADMIN'
      status: string
      emailVerified: boolean
      phoneVerified: boolean
    }
  }
}

// Auth middleware plugin
const authMiddleware: FastifyPluginAsync = async (fastify) => {
  // Utility to verify and decode JWT
  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Extract token from Authorization header
      const authorization = request.headers.authorization
      if (!authorization || !authorization.startsWith('Bearer ')) {
        return reply.status(401).send({
          error: 'Token não fornecido',
          message: 'Acesso negado. Token de autorização necessário.'
        })
      }

      const token = authorization.substring(7) // Remove "Bearer "

      // Verify JWT token
      const payload = fastify.jwt.verify(token)
      const validatedPayload = jwtPayloadSchema.parse(payload)

      // Check if user exists and is active (with caching)
      let user = await cacheService.getCachedUser(validatedPayload.userId)
      
      if (!user) {
        user = await prisma.user.findUnique({
          where: { id: validatedPayload.userId },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            status: true,
            emailVerified: true,
            phoneVerified: true,
            lastLoginAt: true,
          }
        })

        if (!user) {
          return reply.status(401).send({
            error: 'Usuário não encontrado',
            message: 'Token inválido ou usuário não existe.'
          })
        }

        // Cache user for 30 minutes
        await cacheService.cacheUser(user.id, user, 1800)
      }

      // Check if user is active
      if (user.status !== 'ACTIVE') {
        return reply.status(403).send({
          error: 'Conta inativa',
          message: 'Sua conta está inativa. Entre em contato com o suporte.'
        })
      }

      // Update last login time (async, don't wait)
      prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() }
      }).catch(error => {
        fastify.log.error('Error updating lastLoginAt:', error)
      })

      // Attach user to request
      request.user = user
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return reply.status(401).send({
          error: 'Token expirado',
          message: 'Sua sessão expirou. Faça login novamente.'
        })
      }

      if (error.name === 'JsonWebTokenError') {
        return reply.status(401).send({
          error: 'Token inválido',
          message: 'Token de autorização inválido.'
        })
      }

      fastify.log.error('Authentication error:', error)
      return reply.status(401).send({
        error: 'Erro de autenticação',
        message: 'Falha na autenticação. Tente novamente.'
      })
    }
  })

  // Optional authentication (for routes that work with or without auth)
  fastify.decorate('optionalAuth', async (request: FastifyRequest, reply: FastifyReply) => {
    const authorization = request.headers.authorization
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return // Continue without authentication
    }

    try {
      await fastify.authenticate(request, reply)
    } catch (error) {
      // Ignore authentication errors for optional auth
      request.user = undefined
    }
  })

  // Role-based authorization
  fastify.decorate('requireRole', (roles: string | string[]) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      // First authenticate
      await fastify.authenticate(request, reply)

      if (reply.sent) return // Authentication failed

      const userRole = request.user?.role
      const allowedRoles = Array.isArray(roles) ? roles : [roles]

      if (!userRole || !allowedRoles.includes(userRole)) {
        return reply.status(403).send({
          error: 'Acesso negado',
          message: 'Você não tem permissão para acessar este recurso.'
        })
      }
    }
  })

  // Email verification check
  fastify.decorate('requireEmailVerification', async (request: FastifyRequest, reply: FastifyReply) => {
    await fastify.authenticate(request, reply)
    
    if (reply.sent) return

    if (!request.user?.emailVerified) {
      return reply.status(403).send({
        error: 'Email não verificado',
        message: 'Você precisa verificar seu email antes de acessar este recurso.'
      })
    }
  })

  // Phone verification check
  fastify.decorate('requirePhoneVerification', async (request: FastifyRequest, reply: FastifyReply) => {
    await fastify.authenticate(request, reply)
    
    if (reply.sent) return

    if (!request.user?.phoneVerified) {
      return reply.status(403).send({
        error: 'Telefone não verificado',
        message: 'Você precisa verificar seu telefone antes de acessar este recurso.'
      })
    }
  })

  // Host verification (for host-only routes)
  fastify.decorate('requireHost', async (request: FastifyRequest, reply: FastifyReply) => {
    await fastify.authenticate(request, reply)
    
    if (reply.sent) return

    const userRole = request.user?.role
    if (userRole !== 'HOST' && userRole !== 'ADMIN') {
      return reply.status(403).send({
        error: 'Acesso restrito',
        message: 'Este recurso é exclusivo para anfitriões.'
      })
    }

    // Check if host profile exists and is verified
    const hostProfile = await prisma.hostProfile.findUnique({
      where: { userId: request.user!.id },
      select: { identityVerified: true, backgroundCheck: true }
    })

    if (!hostProfile) {
      return reply.status(403).send({
        error: 'Perfil de anfitrião não encontrado',
        message: 'Você precisa completar seu perfil de anfitrião.'
      })
    }
  })

  // Admin only
  fastify.decorate('requireAdmin', async (request: FastifyRequest, reply: FastifyReply) => {
    await fastify.requireRole('ADMIN')(request, reply)
  })
}

// Rate limiting for authentication endpoints
export const authRateLimit = {
  max: 5, // 5 attempts
  timeWindow: 15 * 60 * 1000, // 15 minutes
  errorResponseBuilder: () => ({
    error: 'Muitas tentativas',
    message: 'Você fez muitas tentativas. Tente novamente em 15 minutos.'
  })
}

// Password strength validation
export const passwordSchema = z.string()
  .min(8, 'Senha deve ter pelo menos 8 caracteres')
  .max(100, 'Senha deve ter no máximo 100 caracteres')
  .regex(/[A-Z]/, 'Senha deve conter pelo menos uma letra maiúscula')
  .regex(/[a-z]/, 'Senha deve conter pelo menos uma letra minúscula')
  .regex(/[0-9]/, 'Senha deve conter pelo menos um número')
  .regex(/[^A-Za-z0-9]/, 'Senha deve conter pelo menos um caractere especial')

// Email validation
export const emailSchema = z.string()
  .email('Email inválido')
  .max(255, 'Email deve ter no máximo 255 caracteres')
  .transform(email => email.toLowerCase().trim())

// CPF validation
export function isValidCPF(cpf: string): boolean {
  cpf = cpf.replace(/[^\d]/g, '')
  
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false
  
  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cpf[i]) * (10 - i)
  }
  let digit1 = sum % 11 < 2 ? 0 : 11 - (sum % 11)
  
  if (parseInt(cpf[9]) !== digit1) return false
  
  sum = 0
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cpf[i]) * (11 - i)
  }
  let digit2 = sum % 11 < 2 ? 0 : 11 - (sum % 11)
  
  return parseInt(cpf[10]) === digit2
}

// CNPJ validation
export function isValidCNPJ(cnpj: string): boolean {
  cnpj = cnpj.replace(/[^\d]/g, '')
  
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false
  
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  
  let sum = 0
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cnpj[i]) * weights1[i]
  }
  let digit1 = sum % 11 < 2 ? 0 : 11 - (sum % 11)
  
  if (parseInt(cnpj[12]) !== digit1) return false
  
  sum = 0
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cnpj[i]) * weights2[i]
  }
  let digit2 = sum % 11 < 2 ? 0 : 11 - (sum % 11)
  
  return parseInt(cnpj[13]) === digit2
}

// Brazilian phone validation
export function isValidBrazilianPhone(phone: string): boolean {
  const phoneRegex = /^(\+55|55)?[\s-]?\(?([1-9]{2})\)?[\s-]?([9]?\d{4})[\s-]?(\d{4})$/
  return phoneRegex.test(phone)
}

// Security headers middleware
export const securityHeaders = async (request: FastifyRequest, reply: FastifyReply) => {
  reply.header('X-Content-Type-Options', 'nosniff')
  reply.header('X-Frame-Options', 'DENY')
  reply.header('X-XSS-Protection', '1; mode=block')
  reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  reply.header('Referrer-Policy', 'strict-origin-when-cross-origin')
  reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
}

// Input sanitization
export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove basic HTML tags
    .substring(0, 1000) // Limit length
}

// Generate secure tokens
export function generateSecureToken(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export default fp(authMiddleware, {
  name: 'auth-middleware'
})
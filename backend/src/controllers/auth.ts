import { FastifyRequest, FastifyReply } from 'fastify'
import bcrypt from 'bcrypt'
import { z } from 'zod'
import { prisma } from '@/config/database.js'
import { config } from '@/config/environment.js'
import { sessionService, rateLimitService } from '@/config/redis.js'
import { 
  passwordSchema, 
  emailSchema, 
  isValidCPF, 
  isValidCNPJ,
  isValidBrazilianPhone,
  generateSecureToken 
} from '@/middleware/auth.js'
import { EmailService } from '@/services/email.js'
import { WhatsAppService } from '@/services/whatsapp.js'

// Validation schemas
const registerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100),
  email: emailSchema,
  password: passwordSchema,
  phone: z.string().optional(),
  dateOfBirth: z.string().datetime().optional(),
  role: z.enum(['GUEST', 'HOST']).default('GUEST'),
  cpf: z.string().optional(),
  cnpj: z.string().optional(),
  acceptTerms: z.boolean().refine(val => val === true, 'Você deve aceitar os termos'),
  referralCode: z.string().optional(),
})

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Senha é obrigatória'),
  rememberMe: z.boolean().default(false),
})

const forgotPasswordSchema = z.object({
  email: emailSchema,
})

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token é obrigatório'),
  password: passwordSchema,
})

const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Token é obrigatório'),
})

const resendVerificationSchema = z.object({
  email: emailSchema,
})

const socialLoginSchema = z.object({
  provider: z.enum(['google', 'facebook', 'apple']),
  token: z.string().min(1, 'Token is required'),
  name: z.string().min(1, 'Name is required'),
  email: emailSchema,
  picture: z.string().optional(),
  role: z.enum(['GUEST', 'HOST']).default('GUEST'),
  referralCode: z.string().optional(),
})

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Senha atual é obrigatória'),
  newPassword: passwordSchema,
})

export class AuthController {
  private emailService = new EmailService()
  private whatsappService = new WhatsAppService()

  // User registration
  async register(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = registerSchema.parse(request.body)

      // Rate limiting
      const clientIp = request.ip
      const rateLimit = await rateLimitService.checkRateLimit(`register:${clientIp}`, 300, 3)
      if (!rateLimit.allowed) {
        return reply.status(429).send({
          error: 'Muitas tentativas',
          message: 'Aguarde alguns minutos antes de tentar novamente.',
          resetTime: rateLimit.resetTime
        })
      }

      // Validate CPF or CNPJ if provided
      if (body.cpf && !isValidCPF(body.cpf)) {
        return reply.status(400).send({
          error: 'CPF inválido',
          message: 'O CPF informado não é válido.'
        })
      }

      if (body.cnpj && !isValidCNPJ(body.cnpj)) {
        return reply.status(400).send({
          error: 'CNPJ inválido',
          message: 'O CNPJ informado não é válido.'
        })
      }

      // Validate phone if provided
      if (body.phone && !isValidBrazilianPhone(body.phone)) {
        return reply.status(400).send({
          error: 'Telefone inválido',
          message: 'O telefone informado não é válido.'
        })
      }

      // Check if email already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: body.email }
      })

      if (existingUser) {
        return reply.status(409).send({
          error: 'Email já cadastrado',
          message: 'Este email já está sendo usado por outra conta.'
        })
      }

      // Check if CPF already exists
      if (body.cpf) {
        const existingCPF = await prisma.user.findUnique({
          where: { cpf: body.cpf }
        })

        if (existingCPF) {
          return reply.status(409).send({
            error: 'CPF já cadastrado',
            message: 'Este CPF já está sendo usado por outra conta.'
          })
        }
      }

      // Check if CNPJ already exists
      if (body.cnpj) {
        const existingCNPJ = await prisma.user.findUnique({
          where: { cnpj: body.cnpj }
        })

        if (existingCNPJ) {
          return reply.status(409).send({
            error: 'CNPJ já cadastrado',
            message: 'Este CNPJ já está sendo usado por outra conta.'
          })
        }
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(body.password, config.BCRYPT_ROUNDS)

      // Generate email verification token
      const emailVerificationToken = generateSecureToken(64)

      // Create user
      const user = await prisma.user.create({
        data: {
          name: body.name,
          email: body.email,
          password: hashedPassword,
          phone: body.phone,
          cpf: body.cpf,
          cnpj: body.cnpj,
          dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
          role: body.role,
          status: 'PENDING_VERIFICATION',
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          createdAt: true,
        }
      })

      // Store verification token in Redis (expires in 24 hours)
      await sessionService.createSession(
        `email_verification:${emailVerificationToken}`,
        user.id,
        { type: 'email_verification', email: user.email },
        86400
      )

      // Create profile based on role
      if (body.role === 'HOST') {
        await prisma.hostProfile.create({
          data: { userId: user.id }
        })
      } else {
        await prisma.guestProfile.create({
          data: { userId: user.id }
        })
      }

      // Send verification email
      try {
        await this.emailService.sendVerificationEmail(user.email, user.name, emailVerificationToken)
      } catch (error) {
        request.log.error('Failed to send verification email:', error)
        // Don't fail registration if email fails
      }

      // Send welcome WhatsApp message if phone provided
      if (body.phone) {
        try {
          await this.whatsappService.sendWelcomeMessage(body.phone, user.name)
        } catch (error) {
          request.log.error('Failed to send WhatsApp welcome message:', error)
        }
      }

      return reply.status(201).send({
        message: 'Conta criada com sucesso! Verifique seu email para ativar a conta.',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
          createdAt: user.createdAt,
        }
      })

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Dados inválidos',
          message: 'Verifique os dados fornecidos.',
          details: error.errors
        })
      }

      request.log.error('Registration error:', error)
      return reply.status(500).send({
        error: 'Erro interno',
        message: 'Erro interno do servidor. Tente novamente mais tarde.'
      })
    }
  }

  // Social login (Google, Facebook, Apple)
  async socialLogin(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = socialLoginSchema.parse(request.body)

      // Rate limiting
      const clientIp = request.ip
      const rateLimit = await rateLimitService.checkRateLimit(`social_login:${clientIp}`, 300, 10)
      if (!rateLimit.allowed) {
        return reply.status(429).send({
          error: 'Muitas tentativas',
          message: 'Aguarde alguns minutos antes de tentar novamente.',
          resetTime: rateLimit.resetTime
        })
      }

      // Verify social token (this would need actual implementation)
      // For now, we'll trust the frontend verification
      let socialId: string
      switch (body.provider) {
        case 'google':
          socialId = 'googleId'
          break
        case 'facebook':
          socialId = 'facebookId'
          break
        case 'apple':
          socialId = 'appleId'
          break
      }

      // Check if user exists with this social account
      let user = await prisma.user.findFirst({
        where: {
          OR: [
            { email: body.email },
            { [socialId]: body.token }
          ]
        },
        include: {
          hostProfile: true,
          guestProfile: true,
        }
      })

      if (user) {
        // User exists - update social ID if not set
        if (!user[socialId as keyof typeof user]) {
          user = await prisma.user.update({
            where: { id: user.id },
            data: { [socialId]: body.token },
            include: {
              hostProfile: true,
              guestProfile: true,
            }
          })
        }
      } else {
        // Create new user
        user = await prisma.user.create({
          data: {
            name: body.name,
            email: body.email,
            avatar: body.picture,
            [socialId]: body.token,
            role: body.role,
            status: 'ACTIVE', // Social accounts are pre-verified
            emailVerified: true, // Trust social provider verification
          },
          include: {
            hostProfile: true,
            guestProfile: true,
          }
        })

        // Create profile based on role
        if (body.role === 'HOST') {
          await prisma.hostProfile.create({
            data: { userId: user.id }
          })
        } else {
          await prisma.guestProfile.create({
            data: { userId: user.id }
          })
        }

        // Send welcome WhatsApp message if possible
        try {
          await this.whatsappService.sendWelcomeMessage(body.email, user.name)
        } catch (error) {
          request.log.error('Failed to send WhatsApp welcome message:', error)
        }
      }

      // Check if user is suspended or inactive
      if (user.status === 'SUSPENDED') {
        return reply.status(403).send({
          error: 'Conta suspensa',
          message: 'Sua conta foi suspensa. Entre em contato com o suporte.'
        })
      }

      if (user.status === 'INACTIVE') {
        return reply.status(403).send({
          error: 'Conta inativa',
          message: 'Sua conta está inativa. Entre em contato com o suporte.'
        })
      }

      // Generate JWT token
      const token = request.server.jwt.sign(
        { userId: user.id, role: user.role },
        { expiresIn: '30d' } // Social logins get longer expiry
      )

      // Create session
      const sessionData = {
        userAgent: request.headers['user-agent'] || 'unknown',
        ip: clientIp,
        loginMethod: body.provider,
        lastActivity: new Date().toISOString(),
      }

      await sessionService.createSession(
        `user_session:${user.id}:${Date.now()}`,
        user.id,
        sessionData,
        30 * 24 * 60 * 60 // 30 days
      )

      // Update last login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() }
      })

      return reply.send({
        message: 'Login social realizado com sucesso!',
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          role: user.role,
          status: user.status,
          emailVerified: user.emailVerified,
          phoneVerified: user.phoneVerified,
          documentVerified: user.documentVerified,
          twoFactorEnabled: user.twoFactorEnabled,
          profile: user.role === 'HOST' ? user.hostProfile : user.guestProfile,
        },
        isNewUser: !user.createdAt || (new Date().getTime() - user.createdAt.getTime()) < 60000, // Created within last minute
        expiresIn: '30d',
      })

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Dados inválidos',
          message: 'Verifique os dados fornecidos.',
          details: error.errors
        })
      }

      request.log.error('Social login error:', error)
      return reply.status(500).send({
        error: 'Erro interno',
        message: 'Erro interno do servidor. Tente novamente mais tarde.'
      })
    }
  }

  // User login
  async login(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = loginSchema.parse(request.body)

      // Rate limiting per IP and email
      const clientIp = request.ip
      const ipRateLimit = await rateLimitService.checkRateLimit(`login:ip:${clientIp}`, 900, 10)
      const emailRateLimit = await rateLimitService.checkRateLimit(`login:email:${body.email}`, 900, 5)

      if (!ipRateLimit.allowed || !emailRateLimit.allowed) {
        return reply.status(429).send({
          error: 'Muitas tentativas',
          message: 'Muitas tentativas de login. Tente novamente mais tarde.',
          resetTime: ipRateLimit.resetTime
        })
      }

      // Find user
      const user = await prisma.user.findUnique({
        where: { email: body.email },
        include: {
          hostProfile: true,
          guestProfile: true,
        }
      })

      if (!user || !user.password) {
        return reply.status(401).send({
          error: 'Credenciais inválidas',
          message: 'Email ou senha incorretos.'
        })
      }

      // Verify password
      const passwordMatch = await bcrypt.compare(body.password, user.password)
      if (!passwordMatch) {
        return reply.status(401).send({
          error: 'Credenciais inválidas',
          message: 'Email ou senha incorretos.'
        })
      }

      // Check if user is suspended
      if (user.status === 'SUSPENDED') {
        return reply.status(403).send({
          error: 'Conta suspensa',
          message: 'Sua conta foi suspensa. Entre em contato com o suporte.'
        })
      }

      // Check if user is inactive
      if (user.status === 'INACTIVE') {
        return reply.status(403).send({
          error: 'Conta inativa',
          message: 'Sua conta está inativa. Entre em contato com o suporte.'
        })
      }

      // Generate JWT token
      const tokenExpiry = body.rememberMe ? '30d' : '7d'
      const token = request.server.jwt.sign(
        { userId: user.id, role: user.role },
        { expiresIn: tokenExpiry }
      )

      // Create session
      const sessionData = {
        userAgent: request.headers['user-agent'] || 'unknown',
        ip: clientIp,
        lastActivity: new Date().toISOString(),
      }

      await sessionService.createSession(
        `user_session:${user.id}:${Date.now()}`,
        user.id,
        sessionData,
        body.rememberMe ? 30 * 24 * 60 * 60 : 7 * 24 * 60 * 60 // 30 days or 7 days
      )

      // Update last login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() }
      })

      return reply.send({
        message: 'Login realizado com sucesso!',
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          role: user.role,
          status: user.status,
          emailVerified: user.emailVerified,
          phoneVerified: user.phoneVerified,
          documentVerified: user.documentVerified,
          twoFactorEnabled: user.twoFactorEnabled,
          profile: user.role === 'HOST' ? user.hostProfile : user.guestProfile,
        },
        expiresIn: tokenExpiry,
      })

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Dados inválidos',
          message: 'Verifique os dados fornecidos.',
          details: error.errors
        })
      }

      request.log.error('Login error:', error)
      return reply.status(500).send({
        error: 'Erro interno',
        message: 'Erro interno do servidor. Tente novamente mais tarde.'
      })
    }
  }

  // Verify email
  async verifyEmail(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = verifyEmailSchema.parse(request.body)

      // Get verification data from Redis
      const verificationData = await sessionService.getSession(`email_verification:${body.token}`)
      if (!verificationData) {
        return reply.status(400).send({
          error: 'Token inválido',
          message: 'Token de verificação inválido ou expirado.'
        })
      }

      // Update user email verification
      const user = await prisma.user.update({
        where: { id: verificationData.userId },
        data: {
          emailVerified: true,
          status: 'ACTIVE', // Activate account after email verification
        },
        select: {
          id: true,
          name: true,
          email: true,
          emailVerified: true,
          status: true,
        }
      })

      // Delete verification token
      await sessionService.deleteSession(`email_verification:${body.token}`)

      // Send welcome email
      try {
        await this.emailService.sendWelcomeEmail(user.email, user.name)
      } catch (error) {
        request.log.error('Failed to send welcome email:', error)
      }

      return reply.send({
        message: 'Email verificado com sucesso! Sua conta está ativa.',
        user
      })

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Dados inválidos',
          details: error.errors
        })
      }

      request.log.error('Email verification error:', error)
      return reply.status(500).send({
        error: 'Erro interno',
        message: 'Erro interno do servidor.'
      })
    }
  }

  // Resend verification email
  async resendVerification(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = resendVerificationSchema.parse(request.body)

      // Rate limiting
      const rateLimit = await rateLimitService.checkRateLimit(`resend_verification:${body.email}`, 300, 2)
      if (!rateLimit.allowed) {
        return reply.status(429).send({
          error: 'Muitas tentativas',
          message: 'Aguarde 5 minutos antes de solicitar outro email de verificação.'
        })
      }

      // Find user
      const user = await prisma.user.findUnique({
        where: { email: body.email }
      })

      if (!user) {
        return reply.status(404).send({
          error: 'Usuário não encontrado',
          message: 'Email não encontrado em nosso sistema.'
        })
      }

      if (user.emailVerified) {
        return reply.status(400).send({
          error: 'Email já verificado',
          message: 'Seu email já foi verificado.'
        })
      }

      // Generate new verification token
      const emailVerificationToken = generateSecureToken(64)

      // Store verification token
      await sessionService.createSession(
        `email_verification:${emailVerificationToken}`,
        user.id,
        { type: 'email_verification', email: user.email },
        86400
      )

      // Send verification email
      await this.emailService.sendVerificationEmail(user.email, user.name, emailVerificationToken)

      return reply.send({
        message: 'Email de verificação reenviado com sucesso!'
      })

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Email inválido',
          details: error.errors
        })
      }

      request.log.error('Resend verification error:', error)
      return reply.status(500).send({
        error: 'Erro interno',
        message: 'Não foi possível reenviar o email de verificação.'
      })
    }
  }

  // Forgot password
  async forgotPassword(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = forgotPasswordSchema.parse(request.body)

      // Rate limiting
      const rateLimit = await rateLimitService.checkRateLimit(`forgot_password:${body.email}`, 3600, 3)
      if (!rateLimit.allowed) {
        return reply.status(429).send({
          error: 'Muitas tentativas',
          message: 'Aguarde 1 hora antes de solicitar nova recuperação de senha.'
        })
      }

      // Find user
      const user = await prisma.user.findUnique({
        where: { email: body.email }
      })

      // Always return success to prevent email enumeration
      const successMessage = 'Se o email estiver cadastrado, você receberá instruções para recuperar sua senha.'

      if (!user) {
        return reply.send({ message: successMessage })
      }

      // Generate reset token
      const resetToken = generateSecureToken(64)

      // Store reset token (expires in 1 hour)
      await sessionService.createSession(
        `password_reset:${resetToken}`,
        user.id,
        { type: 'password_reset', email: user.email },
        3600
      )

      // Send reset email
      try {
        await this.emailService.sendPasswordResetEmail(user.email, user.name, resetToken)
      } catch (error) {
        request.log.error('Failed to send password reset email:', error)
      }

      return reply.send({ message: successMessage })

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Email inválido',
          details: error.errors
        })
      }

      request.log.error('Forgot password error:', error)
      return reply.status(500).send({
        error: 'Erro interno',
        message: 'Não foi possível processar a solicitação.'
      })
    }
  }

  // Reset password
  async resetPassword(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = resetPasswordSchema.parse(request.body)

      // Get reset data from Redis
      const resetData = await sessionService.getSession(`password_reset:${body.token}`)
      if (!resetData) {
        return reply.status(400).send({
          error: 'Token inválido',
          message: 'Token de recuperação inválido ou expirado.'
        })
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(body.password, config.BCRYPT_ROUNDS)

      // Update user password
      await prisma.user.update({
        where: { id: resetData.userId },
        data: { password: hashedPassword }
      })

      // Delete reset token
      await sessionService.deleteSession(`password_reset:${body.token}`)

      // Invalidate all user sessions for security
      await sessionService.deleteUserSessions(resetData.userId)

      return reply.send({
        message: 'Senha alterada com sucesso! Faça login com a nova senha.'
      })

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Dados inválidos',
          details: error.errors
        })
      }

      request.log.error('Reset password error:', error)
      return reply.status(500).send({
        error: 'Erro interno',
        message: 'Não foi possível alterar a senha.'
      })
    }
  }

  // Change password (authenticated)
  async changePassword(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = changePasswordSchema.parse(request.body)
      const userId = request.user!.id

      // Get current user with password
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { password: true }
      })

      if (!user?.password) {
        return reply.status(400).send({
          error: 'Usuário inválido',
          message: 'Não foi possível validar o usuário.'
        })
      }

      // Verify current password
      const passwordMatch = await bcrypt.compare(body.currentPassword, user.password)
      if (!passwordMatch) {
        return reply.status(400).send({
          error: 'Senha incorreta',
          message: 'A senha atual está incorreta.'
        })
      }

      // Check if new password is different
      const samePassword = await bcrypt.compare(body.newPassword, user.password)
      if (samePassword) {
        return reply.status(400).send({
          error: 'Senha igual',
          message: 'A nova senha deve ser diferente da atual.'
        })
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(body.newPassword, config.BCRYPT_ROUNDS)

      // Update password
      await prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword }
      })

      return reply.send({
        message: 'Senha alterada com sucesso!'
      })

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Dados inválidos',
          details: error.errors
        })
      }

      request.log.error('Change password error:', error)
      return reply.status(500).send({
        error: 'Erro interno',
        message: 'Não foi possível alterar a senha.'
      })
    }
  }

  // Get current user profile
  async getProfile(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = request.user!.id

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          addresses: true,
          hostProfile: true,
          guestProfile: true,
        }
      })

      if (!user) {
        return reply.status(404).send({
          error: 'Usuário não encontrado'
        })
      }

      // Remove sensitive data
      const { password, ...safeUser } = user

      return reply.send({
        user: safeUser
      })

    } catch (error) {
      request.log.error('Get profile error:', error)
      return reply.status(500).send({
        error: 'Erro interno',
        message: 'Não foi possível carregar o perfil.'
      })
    }
  }

  // Logout
  async logout(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = request.user!.id

      // Invalidate current session
      // Note: In a real implementation, you'd track session IDs
      // For now, we'll just return success since JWTs are stateless
      
      return reply.send({
        message: 'Logout realizado com sucesso!'
      })

    } catch (error) {
      request.log.error('Logout error:', error)
      return reply.status(500).send({
        error: 'Erro interno',
        message: 'Erro ao fazer logout.'
      })
    }
  }
}
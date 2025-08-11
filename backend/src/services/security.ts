import { FastifyRequest } from 'fastify'
import { prisma } from '@/config/database.js'
import { cacheService, rateLimitService } from '@/config/redis.js'
import { createHash, randomBytes } from 'crypto'

interface SecurityEvent {
  type: 'login_attempt' | 'suspicious_activity' | 'rate_limit_exceeded' | 'data_breach_attempt' | 'fraud_detection'
  severity: 'low' | 'medium' | 'high' | 'critical'
  userId?: string
  ip: string
  userAgent: string
  data: any
  timestamp: Date
}

interface ThreatIntelligence {
  ip: string
  country?: string
  isKnownThreat: boolean
  riskScore: number
  reasons: string[]
}

export class SecurityService {
  
  // Main security monitoring middleware
  async monitorRequest(request: FastifyRequest): Promise<{ allowed: boolean; reason?: string }> {
    const clientIP = this.getClientIP(request)
    const userAgent = request.headers['user-agent'] || ''
    
    // Check IP reputation
    const threatIntel = await this.checkThreatIntelligence(clientIP)
    if (threatIntel.isKnownThreat && threatIntel.riskScore > 8) {
      await this.logSecurityEvent({
        type: 'suspicious_activity',
        severity: 'critical',
        ip: clientIP,
        userAgent,
        data: { threatIntel },
        timestamp: new Date()
      })
      return { allowed: false, reason: 'IP blocked due to security threat' }
    }

    // Check for suspicious patterns
    const suspiciousActivity = await this.detectSuspiciousActivity(request, clientIP)
    if (suspiciousActivity.detected) {
      await this.logSecurityEvent({
        type: 'suspicious_activity',
        severity: suspiciousActivity.severity,
        ip: clientIP,
        userAgent,
        data: suspiciousActivity.details,
        timestamp: new Date()
      })
      
      if (suspiciousActivity.severity === 'critical') {
        return { allowed: false, reason: 'Request blocked due to suspicious activity' }
      }
    }

    // Rate limiting checks
    const rateLimitCheck = await this.checkRateLimit(request, clientIP)
    if (!rateLimitCheck.allowed) {
      await this.logSecurityEvent({
        type: 'rate_limit_exceeded',
        severity: 'medium',
        ip: clientIP,
        userAgent,
        data: { limit: rateLimitCheck.limit, current: rateLimitCheck.current },
        timestamp: new Date()
      })
      return { allowed: false, reason: 'Rate limit exceeded' }
    }

    return { allowed: true }
  }

  // Authentication security
  async validateLoginAttempt(email: string, ip: string, userAgent: string): Promise<{ allowed: boolean; reason?: string }> {
    const cacheKey = `login_attempts:${ip}:${email}`
    
    try {
      // Check login attempt rate (5 attempts per 15 minutes)
      const attempts = await cacheService.get(cacheKey)
      const currentAttempts = attempts ? parseInt(attempts) : 0
      
      if (currentAttempts >= 5) {
        await this.logSecurityEvent({
          type: 'login_attempt',
          severity: 'high',
          ip,
          userAgent,
          data: { email, attempts: currentAttempts, blocked: true },
          timestamp: new Date()
        })
        return { allowed: false, reason: 'Too many login attempts' }
      }

      // Increment attempt counter
      await cacheService.set(cacheKey, (currentAttempts + 1).toString(), 900) // 15 minutes

      // Check for credential stuffing patterns
      const credentialStuffingCheck = await this.detectCredentialStuffing(ip)
      if (credentialStuffingCheck.detected) {
        await this.logSecurityEvent({
          type: 'suspicious_activity',
          severity: 'critical',
          ip,
          userAgent,
          data: { type: 'credential_stuffing', details: credentialStuffingCheck },
          timestamp: new Date()
        })
        return { allowed: false, reason: 'Suspicious login pattern detected' }
      }

      return { allowed: true }
      
    } catch (error) {
      console.error('Login validation error:', error)
      return { allowed: true } // Fail open to avoid blocking legitimate users
    }
  }

  // Clear login attempts on successful login
  async clearLoginAttempts(email: string, ip: string): Promise<void> {
    const cacheKey = `login_attempts:${ip}:${email}`
    try {
      await cacheService.del(cacheKey)
    } catch (error) {
      console.error('Error clearing login attempts:', error)
    }
  }

  // Fraud detection for bookings and payments
  async detectBookingFraud(bookingData: any, userId: string, ip: string): Promise<{ isFraud: boolean; riskScore: number; reasons: string[] }> {
    const reasons: string[] = []
    let riskScore = 0

    // Check user booking history
    const userBookings = await prisma.booking.count({
      where: {
        guestId: userId,
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      }
    })

    // Too many bookings in short period
    if (userBookings > 10) {
      reasons.push('High booking frequency')
      riskScore += 3
    }

    // Check for price manipulation attempts
    const property = await prisma.property.findUnique({
      where: { id: bookingData.propertyId },
      select: { basePrice: true }
    })

    if (property && bookingData.totalPrice < property.basePrice * 0.5) {
      reasons.push('Suspicious pricing')
      riskScore += 4
    }

    // Check IP reputation
    const threatIntel = await this.checkThreatIntelligence(ip)
    if (threatIntel.riskScore > 6) {
      reasons.push('High-risk IP address')
      riskScore += threatIntel.riskScore * 0.5
    }

    // Check for rapid bookings from same IP
    const recentBookingsFromIP = await this.getRecentBookingsFromIP(ip)
    if (recentBookingsFromIP > 5) {
      reasons.push('Multiple bookings from same IP')
      riskScore += 3
    }

    const isFraud = riskScore >= 7

    if (isFraud) {
      await this.logSecurityEvent({
        type: 'fraud_detection',
        severity: 'high',
        userId,
        ip,
        userAgent: '',
        data: { type: 'booking_fraud', riskScore, reasons, bookingData },
        timestamp: new Date()
      })
    }

    return { isFraud, riskScore, reasons }
  }

  // Payment fraud detection
  async detectPaymentFraud(paymentData: any, userId: string, ip: string): Promise<{ isFraud: boolean; riskScore: number; reasons: string[] }> {
    const reasons: string[] = []
    let riskScore = 0

    // Check for unusual payment patterns
    const recentPayments = await prisma.payment.count({
      where: {
        booking: { guestId: userId },
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }
    })

    if (recentPayments > 5) {
      reasons.push('High payment frequency')
      riskScore += 4
    }

    // Check payment amount vs average
    const userAvgPayment = await prisma.payment.aggregate({
      where: { booking: { guestId: userId } },
      _avg: { amount: true }
    })

    if (userAvgPayment._avg.amount && paymentData.amount > userAvgPayment._avg.amount * 5) {
      reasons.push('Unusually high payment amount')
      riskScore += 3
    }

    // Geographic inconsistency check
    const lastPaymentLocation = await this.getLastPaymentLocation(userId)
    const currentLocation = await this.getLocationFromIP(ip)
    
    if (lastPaymentLocation && currentLocation) {
      const distance = this.calculateDistance(lastPaymentLocation, currentLocation)
      if (distance > 1000) { // More than 1000km
        reasons.push('Geographic location inconsistency')
        riskScore += 2
      }
    }

    const isFraud = riskScore >= 6

    if (isFraud) {
      await this.logSecurityEvent({
        type: 'fraud_detection',
        severity: 'high',
        userId,
        ip,
        userAgent: '',
        data: { type: 'payment_fraud', riskScore, reasons, paymentData },
        timestamp: new Date()
      })
    }

    return { isFraud, riskScore, reasons }
  }

  // Data validation and sanitization
  sanitizeInput(input: any): any {
    if (typeof input === 'string') {
      return input
        .trim()
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
        .replace(/[<>]/g, '') // Remove angle brackets
        .substring(0, 1000) // Limit length
    }
    
    if (typeof input === 'object' && input !== null) {
      const sanitized: any = {}
      for (const [key, value] of Object.entries(input)) {
        sanitized[key] = this.sanitizeInput(value)
      }
      return sanitized
    }
    
    return input
  }

  // SQL injection detection
  detectSQLInjection(input: string): boolean {
    const sqlPatterns = [
      /('|(\\)|;|--|\||\*|\s+(or|and|union|select|insert|update|delete|drop|create|alter|exec|execute)\s+)/i,
      /\bunion\s+select\b/i,
      /\bselect\s+.*\bfrom\b/i,
      /\binsert\s+into\b/i,
      /\bdelete\s+from\b/i,
      /\bdrop\s+table\b/i
    ]

    return sqlPatterns.some(pattern => pattern.test(input))
  }

  // XSS detection
  detectXSS(input: string): boolean {
    const xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/i,
      /on\w+\s*=/i,
      /<iframe/i,
      /<object/i,
      /<embed/i
    ]

    return xssPatterns.some(pattern => pattern.test(input))
  }

  // Log security events
  private async logSecurityEvent(event: SecurityEvent): Promise<void> {
    try {
      await prisma.analytics.create({
        data: {
          event: `security_${event.type}`,
          userId: event.userId,
          sessionId: event.ip,
          data: {
            severity: event.severity,
            ip: event.ip,
            userAgent: event.userAgent,
            ...event.data
          }
        }
      })

      // Store in cache for real-time monitoring
      const cacheKey = `security_event:${Date.now()}:${Math.random()}`
      await cacheService.set(cacheKey, JSON.stringify(event), 3600)

      // Alert on critical events
      if (event.severity === 'critical') {
        await this.sendSecurityAlert(event)
      }
    } catch (error) {
      console.error('Failed to log security event:', error)
    }
  }

  // Send security alerts
  private async sendSecurityAlert(event: SecurityEvent): Promise<void> {
    // This would integrate with alerting systems (email, Slack, PagerDuty, etc.)
    console.log('SECURITY ALERT:', {
      type: event.type,
      severity: event.severity,
      ip: event.ip,
      timestamp: event.timestamp,
      data: event.data
    })

    // Store critical alerts for admin dashboard
    try {
      await prisma.notification.create({
        data: {
          userId: 'system',
          type: 'security_alert',
          title: `Security Alert: ${event.type}`,
          message: `Critical security event detected from IP ${event.ip}`,
          data: event.data
        }
      })
    } catch (error) {
      console.error('Failed to create security alert notification:', error)
    }
  }

  // Helper methods
  private getClientIP(request: FastifyRequest): string {
    return (
      request.headers['x-forwarded-for'] as string ||
      request.headers['x-real-ip'] as string ||
      request.socket.remoteAddress ||
      'unknown'
    ).split(',')[0].trim()
  }

  private async checkThreatIntelligence(ip: string): Promise<ThreatIntelligence> {
    const cacheKey = `threat_intel:${ip}`
    
    try {
      const cached = await cacheService.get(cacheKey)
      if (cached) {
        return JSON.parse(cached)
      }
    } catch (error) {
      // Continue without cache
    }

    // Basic threat intelligence (would integrate with real threat intel APIs)
    const threatIntel: ThreatIntelligence = {
      ip,
      isKnownThreat: false,
      riskScore: 0,
      reasons: []
    }

    // Check known bad IPs (this would be a real database/service)
    const knownBadIPs = ['192.168.1.100', '10.0.0.1'] // Example
    if (knownBadIPs.includes(ip)) {
      threatIntel.isKnownThreat = true
      threatIntel.riskScore = 10
      threatIntel.reasons.push('Known malicious IP')
    }

    // Cache the result for 1 hour
    try {
      await cacheService.set(cacheKey, JSON.stringify(threatIntel), 3600)
    } catch (error) {
      // Continue without cache
    }

    return threatIntel
  }

  private async detectSuspiciousActivity(request: FastifyRequest, ip: string): Promise<{ detected: boolean; severity: 'low' | 'medium' | 'high' | 'critical'; details: any }> {
    const details: any = {}
    let riskScore = 0

    // Check for SQL injection in query parameters
    const queryString = request.url.split('?')[1] || ''
    if (this.detectSQLInjection(queryString)) {
      details.sqlInjectionAttempt = true
      riskScore += 5
    }

    // Check for XSS in query parameters
    if (this.detectXSS(queryString)) {
      details.xssAttempt = true
      riskScore += 4
    }

    // Check user agent patterns
    const userAgent = request.headers['user-agent'] || ''
    if (this.isSuspiciousUserAgent(userAgent)) {
      details.suspiciousUserAgent = true
      riskScore += 2
    }

    // Check request frequency from IP
    const requestCount = await this.getRecentRequestCount(ip)
    if (requestCount > 100) { // More than 100 requests in last minute
      details.highRequestFrequency = true
      riskScore += 3
    }

    // Determine severity
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low'
    if (riskScore >= 7) severity = 'critical'
    else if (riskScore >= 5) severity = 'high'
    else if (riskScore >= 3) severity = 'medium'

    return {
      detected: riskScore > 0,
      severity,
      details
    }
  }

  private async checkRateLimit(request: FastifyRequest, ip: string): Promise<{ allowed: boolean; limit: number; current: number }> {
    const endpoint = request.routerPath || request.url
    const key = `rate_limit:${ip}:${endpoint}`
    
    // Different limits for different endpoints
    let limit = 60 // Default: 60 requests per minute
    
    if (endpoint.includes('/auth/')) limit = 10
    if (endpoint.includes('/payments/')) limit = 20
    if (endpoint.includes('/admin/')) limit = 30

    try {
      const rateLimit = await rateLimitService.checkRateLimit(key, 60, limit)
      return {
        allowed: rateLimit.allowed,
        limit,
        current: limit - rateLimit.remaining
      }
    } catch (error) {
      // Fail open if rate limiting service is down
      return { allowed: true, limit, current: 0 }
    }
  }

  private async detectCredentialStuffing(ip: string): Promise<{ detected: boolean; attempts: number }> {
    const cacheKey = `credential_stuffing:${ip}`
    
    try {
      const attempts = await cacheService.get(cacheKey)
      const attemptCount = attempts ? parseInt(attempts) : 0
      
      // More than 20 different email attempts in 1 hour
      if (attemptCount > 20) {
        return { detected: true, attempts: attemptCount }
      }
    } catch (error) {
      // Continue without cache
    }
    
    return { detected: false, attempts: 0 }
  }

  private isSuspiciousUserAgent(userAgent: string): boolean {
    const suspiciousPatterns = [
      /bot/i,
      /crawler/i,
      /scanner/i,
      /curl/i,
      /wget/i,
      /python/i,
      /perl/i,
      /^$/  // Empty user agent
    ]

    return suspiciousPatterns.some(pattern => pattern.test(userAgent))
  }

  private async getRecentRequestCount(ip: string): Promise<number> {
    const cacheKey = `request_count:${ip}`
    
    try {
      const count = await cacheService.get(cacheKey)
      return count ? parseInt(count) : 0
    } catch (error) {
      return 0
    }
  }

  private async getRecentBookingsFromIP(ip: string): Promise<number> {
    // This would need to be tracked in database or cache
    return 0 // Placeholder
  }

  private async getLastPaymentLocation(userId: string): Promise<{ lat: number; lng: number } | null> {
    // This would track payment locations
    return null // Placeholder
  }

  private async getLocationFromIP(ip: string): Promise<{ lat: number; lng: number } | null> {
    // This would use a geolocation service
    return null // Placeholder
  }

  private calculateDistance(loc1: { lat: number; lng: number }, loc2: { lat: number; lng: number }): number {
    // Haversine formula for distance calculation
    const R = 6371 // Earth's radius in kilometers
    const dLat = this.toRadians(loc2.lat - loc1.lat)
    const dLng = this.toRadians(loc2.lng - loc1.lng)
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(loc1.lat)) * Math.cos(this.toRadians(loc2.lat)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180)
  }
}
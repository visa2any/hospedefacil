import Redis from 'ioredis'
import { config } from './environment.js'

class RedisClient {
  private client: Redis | null = null
  
  constructor() {
    this.connect()
  }
  
  private connect() {
    try {
      this.client = new Redis(config.REDIS_URL, {
        retryDelayOnFailover: 100,
        enableReadyCheck: false,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        
        // Connection events
        connectTimeout: 10000,
        commandTimeout: 5000,
        
        // Reconnection
        reconnectOnError: (err) => {
          const targetError = 'READONLY'
          return err.message.includes(targetError)
        },
        
        // Key prefix for namespacing
        keyPrefix: 'hospedefacil:',
      })
      
      // Event listeners
      this.client.on('connect', () => {
        console.log('✅ Conectado ao Redis')
      })
      
      this.client.on('error', (error) => {
        console.error('❌ Erro no Redis:', error)
      })
      
      this.client.on('reconnecting', () => {
        console.log('🔄 Reconectando ao Redis...')
      })
      
      this.client.on('close', () => {
        console.log('🔌 Conexão Redis fechada')
      })
      
    } catch (error) {
      console.error('❌ Erro ao conectar ao Redis:', error)
    }
  }
  
  // Cache operations
  async get(key: string): Promise<string | null> {
    if (!this.client) return null
    try {
      return await this.client.get(key)
    } catch (error) {
      console.error('Redis GET error:', error)
      return null
    }
  }
  
  async set(key: string, value: string, ttl?: number): Promise<boolean> {
    if (!this.client) return false
    try {
      if (ttl) {
        await this.client.setex(key, ttl, value)
      } else {
        await this.client.set(key, value)
      }
      return true
    } catch (error) {
      console.error('Redis SET error:', error)
      return false
    }
  }
  
  async del(key: string): Promise<boolean> {
    if (!this.client) return false
    try {
      await this.client.del(key)
      return true
    } catch (error) {
      console.error('Redis DEL error:', error)
      return false
    }
  }
  
  async exists(key: string): Promise<boolean> {
    if (!this.client) return false
    try {
      const result = await this.client.exists(key)
      return result === 1
    } catch (error) {
      console.error('Redis EXISTS error:', error)
      return false
    }
  }
  
  // JSON operations
  async setJson(key: string, value: any, ttl?: number): Promise<boolean> {
    return this.set(key, JSON.stringify(value), ttl)
  }
  
  async getJson<T>(key: string): Promise<T | null> {
    const value = await this.get(key)
    if (!value) return null
    
    try {
      return JSON.parse(value) as T
    } catch (error) {
      console.error('JSON parse error:', error)
      return null
    }
  }
  
  // List operations
  async lpush(key: string, ...values: string[]): Promise<number | null> {
    if (!this.client) return null
    try {
      return await this.client.lpush(key, ...values)
    } catch (error) {
      console.error('Redis LPUSH error:', error)
      return null
    }
  }
  
  async rpop(key: string): Promise<string | null> {
    if (!this.client) return null
    try {
      return await this.client.rpop(key)
    } catch (error) {
      console.error('Redis RPOP error:', error)
      return null
    }
  }
  
  // Hash operations
  async hset(key: string, field: string, value: string): Promise<boolean> {
    if (!this.client) return false
    try {
      await this.client.hset(key, field, value)
      return true
    } catch (error) {
      console.error('Redis HSET error:', error)
      return false
    }
  }
  
  async hget(key: string, field: string): Promise<string | null> {
    if (!this.client) return null
    try {
      return await this.client.hget(key, field)
    } catch (error) {
      console.error('Redis HGET error:', error)
      return null
    }
  }
  
  async hgetall(key: string): Promise<Record<string, string> | null> {
    if (!this.client) return null
    try {
      return await this.client.hgetall(key)
    } catch (error) {
      console.error('Redis HGETALL error:', error)
      return null
    }
  }
  
  // Set operations (for rate limiting)
  async sadd(key: string, ...members: string[]): Promise<number | null> {
    if (!this.client) return null
    try {
      return await this.client.sadd(key, ...members)
    } catch (error) {
      console.error('Redis SADD error:', error)
      return null
    }
  }
  
  async sismember(key: string, member: string): Promise<boolean> {
    if (!this.client) return false
    try {
      const result = await this.client.sismember(key, member)
      return result === 1
    } catch (error) {
      console.error('Redis SISMEMBER error:', error)
      return false
    }
  }
  
  // Expiration
  async expire(key: string, seconds: number): Promise<boolean> {
    if (!this.client) return false
    try {
      await this.client.expire(key, seconds)
      return true
    } catch (error) {
      console.error('Redis EXPIRE error:', error)
      return false
    }
  }
  
  // Pattern matching
  async keys(pattern: string): Promise<string[]> {
    if (!this.client) return []
    try {
      return await this.client.keys(pattern)
    } catch (error) {
      console.error('Redis KEYS error:', error)
      return []
    }
  }
  
  // Increment operations (for counters)
  async incr(key: string): Promise<number | null> {
    if (!this.client) return null
    try {
      return await this.client.incr(key)
    } catch (error) {
      console.error('Redis INCR error:', error)
      return null
    }
  }
  
  async incrby(key: string, increment: number): Promise<number | null> {
    if (!this.client) return null
    try {
      return await this.client.incrby(key, increment)
    } catch (error) {
      console.error('Redis INCRBY error:', error)
      return null
    }
  }
  
  // Health check
  async ping(): Promise<boolean> {
    if (!this.client) return false
    try {
      const result = await this.client.ping()
      return result === 'PONG'
    } catch (error) {
      console.error('Redis PING error:', error)
      return false
    }
  }
  
  // Connection management
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit()
      this.client = null
    }
  }
  
  // Get raw client for advanced operations
  getClient(): Redis | null {
    return this.client
  }
}

// Create singleton instance
export const redisClient = new RedisClient()

// Cache utility functions
export class CacheService {
  private prefix = 'cache:'
  
  // Generic cache methods
  async get<T>(key: string): Promise<T | null> {
    return redisClient.getJson<T>(`${this.prefix}${key}`)
  }
  
  async set(key: string, value: any, ttlSeconds = 3600): Promise<boolean> {
    return redisClient.setJson(`${this.prefix}${key}`, value, ttlSeconds)
  }
  
  async del(key: string): Promise<boolean> {
    return redisClient.del(`${this.prefix}${key}`)
  }
  
  // Specific cache methods
  async cacheUser(userId: string, user: any, ttl = 1800): Promise<boolean> {
    return this.set(`user:${userId}`, user, ttl)
  }
  
  async getCachedUser(userId: string): Promise<any> {
    return this.get(`user:${userId}`)
  }
  
  async cacheProperty(propertyId: string, property: any, ttl = 3600): Promise<boolean> {
    return this.set(`property:${propertyId}`, property, ttl)
  }
  
  async getCachedProperty(propertyId: string): Promise<any> {
    return this.get(`property:${propertyId}`)
  }
  
  async cacheSearchResults(query: string, results: any, ttl = 600): Promise<boolean> {
    const queryHash = Buffer.from(query).toString('base64')
    return this.set(`search:${queryHash}`, results, ttl)
  }
  
  async getCachedSearchResults(query: string): Promise<any> {
    const queryHash = Buffer.from(query).toString('base64')
    return this.get(`search:${queryHash}`)
  }
  
  // Invalidate patterns
  async invalidatePattern(pattern: string): Promise<number> {
    const keys = await redisClient.keys(`${this.prefix}${pattern}`)
    if (keys.length === 0) return 0
    
    const client = redisClient.getClient()
    if (!client) return 0
    
    // Remove prefix from keys before deletion since Redis client adds it automatically
    const keysWithoutPrefix = keys.map(key => key.replace('hospedefacil:', ''))
    await client.del(...keysWithoutPrefix)
    return keys.length
  }
  
  // Cache stats
  async getStats(): Promise<{ totalKeys: number; memoryUsage: string }> {
    const client = redisClient.getClient()
    if (!client) return { totalKeys: 0, memoryUsage: '0B' }
    
    try {
      const keys = await redisClient.keys(`${this.prefix}*`)
      const info = await client.info('memory')
      const memoryMatch = info.match(/used_memory_human:(.+)/)
      
      return {
        totalKeys: keys.length,
        memoryUsage: memoryMatch ? memoryMatch[1].trim() : '0B'
      }
    } catch (error) {
      console.error('Cache stats error:', error)
      return { totalKeys: 0, memoryUsage: '0B' }
    }
  }
}

export const cacheService = new CacheService()

// Session management
export class SessionService {
  private prefix = 'session:'
  
  async createSession(sessionId: string, userId: string, data: any, ttl = 86400): Promise<boolean> {
    const sessionData = {
      userId,
      createdAt: new Date().toISOString(),
      lastAccessAt: new Date().toISOString(),
      ...data
    }
    
    return redisClient.setJson(`${this.prefix}${sessionId}`, sessionData, ttl)
  }
  
  async getSession(sessionId: string): Promise<any> {
    const session = await redisClient.getJson(`${this.prefix}${sessionId}`)
    if (session) {
      // Update last access time
      session.lastAccessAt = new Date().toISOString()
      await redisClient.setJson(`${this.prefix}${sessionId}`, session, 86400)
    }
    return session
  }
  
  async updateSession(sessionId: string, data: any): Promise<boolean> {
    const session = await this.getSession(sessionId)
    if (!session) return false
    
    const updatedSession = { ...session, ...data }
    return redisClient.setJson(`${this.prefix}${sessionId}`, updatedSession, 86400)
  }
  
  async deleteSession(sessionId: string): Promise<boolean> {
    return redisClient.del(`${this.prefix}${sessionId}`)
  }
  
  async deleteUserSessions(userId: string): Promise<number> {
    const keys = await redisClient.keys(`${this.prefix}*`)
    let deletedCount = 0
    
    for (const key of keys) {
      const session = await redisClient.getJson(key.replace('hospedefacil:', ''))
      if (session && session.userId === userId) {
        await redisClient.del(key.replace('hospedefacil:', ''))
        deletedCount++
      }
    }
    
    return deletedCount
  }
}

export const sessionService = new SessionService()

// Rate limiting service
export class RateLimitService {
  private prefix = 'ratelimit:'
  
  async checkRateLimit(
    identifier: string, 
    windowSeconds: number, 
    maxRequests: number
  ): Promise<{ allowed: boolean; remaining: number; resetTime: Date }> {
    const key = `${this.prefix}${identifier}`
    const now = Date.now()
    const windowStart = now - (windowSeconds * 1000)
    
    // Clean old entries and count current requests
    const client = redisClient.getClient()
    if (!client) {
      return { allowed: true, remaining: maxRequests - 1, resetTime: new Date(now + windowSeconds * 1000) }
    }
    
    try {
      // Use Redis sorted set to track requests with timestamps
      await client.zremrangebyscore(key, 0, windowStart)
      const currentCount = await client.zcard(key)
      
      const resetTime = new Date(now + windowSeconds * 1000)
      
      if (currentCount >= maxRequests) {
        return { allowed: false, remaining: 0, resetTime }
      }
      
      // Add current request
      await client.zadd(key, now, `${now}-${Math.random()}`)
      await client.expire(key, windowSeconds)
      
      return { 
        allowed: true, 
        remaining: maxRequests - (currentCount + 1), 
        resetTime 
      }
    } catch (error) {
      console.error('Rate limit check error:', error)
      return { allowed: true, remaining: maxRequests - 1, resetTime: new Date(now + windowSeconds * 1000) }
    }
  }
  
  async resetRateLimit(identifier: string): Promise<boolean> {
    return redisClient.del(`${this.prefix}${identifier}`)
  }
}

export const rateLimitService = new RateLimitService()
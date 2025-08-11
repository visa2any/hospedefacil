// Multi-layer Cache Service for HospedeFácil + LiteAPI
// Optimizes performance and reduces API calls

import { UnifiedProperty, PropertyAvailability, CacheEntry, PropertySource } from '../database/schemas'

// Cache Configuration
const CACHE_CONFIG = {
  // Memory cache (fastest, smallest capacity)
  memory: {
    maxSize: 1000, // Max entries in memory
    defaultTtl: 5 * 60 * 1000, // 5 minutes
  },
  
  // Redis cache (medium speed, larger capacity)
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: 0,
    defaultTtl: 30 * 60, // 30 minutes in seconds
  },
  
  // TTL by data type (in seconds)
  ttl: {
    search: 10 * 60,      // 10 minutes - searches change frequently
    property: 60 * 60,    // 1 hour - property data is relatively stable
    availability: 5 * 60,  // 5 minutes - availability changes often
    rates: 10 * 60,      // 10 minutes - rates change often
    images: 24 * 60 * 60, // 24 hours - images rarely change
    static: 7 * 24 * 60 * 60, // 1 week - static content
  }
}

// In-memory cache implementation
class MemoryCache {
  private cache = new Map<string, CacheEntry>()
  private accessOrder = new Map<string, number>()
  private accessCounter = 0

  set(key: string, value: any, ttl: number = CACHE_CONFIG.memory.defaultTtl, type: CacheEntry['type'] = 'search'): void {
    const now = new Date()
    const expiresAt = new Date(now.getTime() + ttl)
    
    // LRU eviction if cache is full
    if (this.cache.size >= CACHE_CONFIG.memory.maxSize) {
      this.evictLRU()
    }
    
    const entry: CacheEntry = {
      key,
      value,
      type,
      createdAt: now,
      expiresAt,
      accessCount: 1,
      lastAccessedAt: now
    }
    
    this.cache.set(key, entry)
    this.accessOrder.set(key, ++this.accessCounter)
  }

  get(key: string): any | null {
    const entry = this.cache.get(key)
    
    if (!entry) return null
    
    // Check expiration
    if (new Date() > entry.expiresAt) {
      this.delete(key)
      return null
    }
    
    // Update access stats
    entry.accessCount++
    entry.lastAccessedAt = new Date()
    this.accessOrder.set(key, ++this.accessCounter)
    
    return entry.value
  }

  delete(key: string): void {
    this.cache.delete(key)
    this.accessOrder.delete(key)
  }

  clear(): void {
    this.cache.clear()
    this.accessOrder.clear()
    this.accessCounter = 0
  }

  private evictLRU(): void {
    // Find least recently used key
    let oldestKey = ''
    let oldestAccess = Infinity
    
    for (const key of Array.from(this.accessOrder.keys())) {
      const accessTime = this.accessOrder.get(key)!
      if (accessTime < oldestAccess) {
        oldestAccess = accessTime
        oldestKey = key
      }
    }
    
    if (oldestKey) {
      this.delete(oldestKey)
    }
  }

  getStats(): {
    size: number
    maxSize: number
    hitRate: number
    entries: Array<{ key: string; type: string; createdAt: Date; accessCount: number }>
  } {
    const entries = Array.from(this.cache.values()).map(entry => ({
      key: entry.key,
      type: entry.type,
      createdAt: entry.createdAt,
      accessCount: entry.accessCount
    }))
    
    // Calculate hit rate (simplified)
    const totalAccesses = entries.reduce((sum, entry) => sum + entry.accessCount, 0)
    const hitRate = totalAccesses > 0 ? entries.length / totalAccesses : 0
    
    return {
      size: this.cache.size,
      maxSize: CACHE_CONFIG.memory.maxSize,
      hitRate,
      entries
    }
  }
}

// Real Redis client wrapper with connection pooling and error handling
import Redis from 'ioredis'

class RedisCache {
  private client: Redis | null = null
  private isConnected = false
  private connectionAttempts = 0
  private maxRetries = 5
  private retryDelay = 1000

  async connect(): Promise<void> {
    try {
      if (typeof window !== 'undefined') {
        // Skip Redis in browser environment
        console.log('⚠️ Redis skipped in browser environment')
        return
      }

      if (this.isConnected && this.client) {
        return // Already connected
      }

      const redisConfig = {
        host: CACHE_CONFIG.redis.host,
        port: CACHE_CONFIG.redis.port,
        password: CACHE_CONFIG.redis.password || undefined,
        db: CACHE_CONFIG.redis.db,
        retryDelayOnFailover: 100,
        enableReadyCheck: false,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        keepAlive: 30000,
        connectTimeout: 10000,
        commandTimeout: 5000,
        retryDelayOnClusterDown: 300,
        enableOfflineQueue: false
      }

      console.log('🔗 Connecting to Redis...', { host: redisConfig.host, port: redisConfig.port })

      this.client = new Redis(redisConfig)

      // Event handlers
      this.client.on('connect', () => {
        console.log('🔗 Redis connected successfully')
        this.isConnected = true
        this.connectionAttempts = 0
      })

      this.client.on('ready', () => {
        console.log('✅ Redis ready for commands')
        this.isConnected = true
      })

      this.client.on('error', (error) => {
        console.error('❌ Redis error:', error.message)
        this.isConnected = false
        this.handleConnectionError(error)
      })

      this.client.on('close', () => {
        console.log('🔌 Redis connection closed')
        this.isConnected = false
      })

      this.client.on('reconnecting', (ms) => {
        console.log(`🔄 Redis reconnecting in ${ms}ms...`)
      })

      // Connect with timeout
      await Promise.race([
        this.client.connect(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), 10000)
        )
      ])

      // Test connection
      await this.client.ping()
      console.log('✅ Redis connection established and tested')

    } catch (error) {
      console.error('❌ Redis connection failed:', error)
      this.isConnected = false
      await this.handleConnectionError(error)
    }
  }

  private async handleConnectionError(error: any): Promise<void> {
    this.connectionAttempts++
    
    if (this.connectionAttempts < this.maxRetries) {
      console.log(`🔄 Redis retry attempt ${this.connectionAttempts}/${this.maxRetries} in ${this.retryDelay}ms`)
      setTimeout(() => this.connect(), this.retryDelay * this.connectionAttempts)
    } else {
      console.error('💥 Redis max retries exceeded, operating without cache')
      this.isConnected = false
    }
  }

  async set(key: string, value: any, ttl: number = CACHE_CONFIG.redis.defaultTtl): Promise<void> {
    if (!this.isConnected || !this.client) {
      console.warn('⚠️ Redis not connected, skipping set operation')
      return
    }
    
    try {
      const serialized = JSON.stringify({
        value,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + ttl * 1000).toISOString()
      })
      
      await this.client.setex(key, ttl, serialized)
      console.log(`💾 Redis SET: ${key} (TTL: ${ttl}s)`)
    } catch (error) {
      console.error('❌ Redis set failed:', error)
      // Attempt reconnection on error
      if (error.message.includes('Connection is closed')) {
        this.isConnected = false
        this.connect()
      }
    }
  }

  async get(key: string): Promise<any | null> {
    if (!this.isConnected || !this.client) {
      console.warn('⚠️ Redis not connected, returning null')
      return null
    }
    
    try {
      const data = await this.client.get(key)
      if (!data) return null
      
      const parsed = JSON.parse(data)
      
      // Check expiration (double check)
      if (new Date() > new Date(parsed.expiresAt)) {
        console.log(`⏰ Redis key expired: ${key}`)
        await this.delete(key)
        return null
      }
      
      console.log(`🎯 Redis GET: ${key}`)
      return parsed.value
    } catch (error) {
      console.error('❌ Redis get failed:', error)
      if (error.message.includes('Connection is closed')) {
        this.isConnected = false
        this.connect()
      }
      return null
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.isConnected || !this.client) return
    
    try {
      const result = await this.client.del(key)
      if (result > 0) {
        console.log(`🗑️ Redis DEL: ${key}`)
      }
    } catch (error) {
      console.error('❌ Redis delete failed:', error)
    }
  }

  async clear(pattern?: string): Promise<void> {
    if (!this.isConnected || !this.client) return
    
    try {
      if (pattern) {
        const keys = await this.client.keys(pattern)
        if (keys.length > 0) {
          await this.client.del(...keys)
          console.log(`🧹 Redis cleared ${keys.length} keys with pattern: ${pattern}`)
        }
      } else {
        await this.client.flushdb()
        console.log('🧹 Redis database cleared')
      }
    } catch (error) {
      console.error('❌ Redis clear failed:', error)
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.isConnected || !this.client) return false
    
    try {
      const result = await this.client.exists(key)
      return result === 1
    } catch (error) {
      console.error('❌ Redis exists check failed:', error)
      return false
    }
  }

  async expire(key: string, ttl: number): Promise<boolean> {
    if (!this.isConnected || !this.client) return false
    
    try {
      const result = await this.client.expire(key, ttl)
      return result === 1
    } catch (error) {
      console.error('❌ Redis expire failed:', error)
      return false
    }
  }

  async increment(key: string, amount: number = 1): Promise<number> {
    if (!this.isConnected || !this.client) return 0
    
    try {
      return await this.client.incrby(key, amount)
    } catch (error) {
      console.error('❌ Redis increment failed:', error)
      return 0
    }
  }

  async getStats(): Promise<any> {
    if (!this.isConnected || !this.client) {
      return {
        connected: false,
        memoryUsed: '0',
        totalKeys: 0,
        uptime: 0
      }
    }
    
    try {
      const [info, dbsize] = await Promise.all([
        this.client.info('memory'),
        this.client.dbsize()
      ])
      
      // Parse memory info
      const memoryLines = info.split('\r\n')
      const usedMemory = memoryLines.find(line => line.startsWith('used_memory_human:'))?.split(':')[1] || '0'
      const maxMemory = memoryLines.find(line => line.startsWith('maxmemory_human:'))?.split(':')[1] || 'unlimited'
      
      return {
        connected: this.isConnected,
        memoryUsed: usedMemory,
        maxMemory,
        totalKeys: dbsize,
        uptime: await this.client.time().then(time => time[0])
      }
    } catch (error) {
      console.error('❌ Redis stats failed:', error)
      return {
        connected: false,
        error: error.message
      }
    }
  }

  async healthCheck(): Promise<boolean> {
    if (!this.isConnected || !this.client) return false
    
    try {
      const result = await this.client.ping()
      return result === 'PONG'
    } catch (error) {
      console.error('❌ Redis health check failed:', error)
      return false
    }
  }

  // Batch operations for better performance
  async mget(keys: string[]): Promise<(any | null)[]> {
    if (!this.isConnected || !this.client || keys.length === 0) return []
    
    try {
      const results = await this.client.mget(...keys)
      return results.map((data, index) => {
        if (!data) return null
        try {
          const parsed = JSON.parse(data)
          if (new Date() > new Date(parsed.expiresAt)) {
            // Expired, clean up in background
            this.delete(keys[index])
            return null
          }
          return parsed.value
        } catch {
          return null
        }
      })
    } catch (error) {
      console.error('❌ Redis mget failed:', error)
      return keys.map(() => null)
    }
  }

  async mset(entries: Array<{ key: string; value: any; ttl?: number }>): Promise<void> {
    if (!this.isConnected || !this.client || entries.length === 0) return
    
    try {
      const pipeline = this.client.pipeline()
      
      entries.forEach(({ key, value, ttl = CACHE_CONFIG.redis.defaultTtl }) => {
        const serialized = JSON.stringify({
          value,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + ttl * 1000).toISOString()
        })
        pipeline.setex(key, ttl, serialized)
      })
      
      await pipeline.exec()
      console.log(`💾 Redis MSET: ${entries.length} keys`)
    } catch (error) {
      console.error('❌ Redis mset failed:', error)
    }
  }

  // Graceful disconnect
  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit()
        console.log('🔌 Redis connection closed gracefully')
      } catch (error) {
        console.error('❌ Error closing Redis connection:', error)
      }
      this.client = null
      this.isConnected = false
    }
  }
}

// Main Cache Service
export class CacheService {
  private memoryCache = new MemoryCache()
  private redisCache = new RedisCache()
  private initialized = false

  async initialize(): Promise<void> {
    if (this.initialized) return
    
    await this.redisCache.connect()
    this.initialized = true
    
    // Start cleanup job
    this.startCleanupJob()
  }

  // Get data from cache (tries memory first, then Redis)
  async get<T>(key: string, type: CacheEntry['type'] = 'search'): Promise<T | null> {
    if (!this.initialized) await this.initialize()
    
    // Try memory cache first (fastest)
    const memoryResult = this.memoryCache.get(key)
    if (memoryResult !== null) {
      console.log(`🎯 Memory cache HIT: ${key}`)
      return memoryResult
    }
    
    // Try Redis cache (slower but larger capacity)
    const redisResult = await this.redisCache.get(key)
    if (redisResult !== null) {
      console.log(`🎯 Redis cache HIT: ${key}`)
      
      // Promote to memory cache for faster future access
      const ttl = this.getTtlByType(type) * 1000 // Convert to milliseconds
      this.memoryCache.set(key, redisResult, ttl, type)
      
      return redisResult
    }
    
    console.log(`❌ Cache MISS: ${key}`)
    return null
  }

  // Set data in both memory and Redis cache
  async set<T>(
    key: string, 
    value: T, 
    type: CacheEntry['type'] = 'search',
    customTtl?: number
  ): Promise<void> {
    if (!this.initialized) await this.initialize()
    
    const ttl = customTtl || this.getTtlByType(type)
    
    // Set in memory cache
    this.memoryCache.set(key, value, ttl * 1000, type) // Convert to milliseconds
    
    // Set in Redis cache
    await this.redisCache.set(key, value, ttl)
    
    console.log(`💾 Cached: ${key} (TTL: ${ttl}s, Type: ${type})`)
  }

  // Delete from all cache layers
  async delete(key: string): Promise<void> {
    if (!this.initialized) await this.initialize()
    
    this.memoryCache.delete(key)
    await this.redisCache.delete(key)
    
    console.log(`🗑️ Deleted from cache: ${key}`)
  }

  // Clear cache by pattern or type
  async clear(pattern?: string, type?: CacheEntry['type']): Promise<void> {
    if (!this.initialized) await this.initialize()
    
    if (type && !pattern) {
      // Clear by type (memory only, Redis doesn't support this easily)
      this.memoryCache.clear()
    } else if (pattern) {
      // Clear by pattern (Redis)
      await this.redisCache.clear(pattern)
    } else {
      // Clear all
      this.memoryCache.clear()
      await this.redisCache.clear()
    }
    
    console.log(`🧹 Cache cleared (pattern: ${pattern}, type: ${type})`)
  }

  // Smart cache key generation
  generateKey(prefix: string, params: Record<string, any>): string {
    // Sort params for consistent keys
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((result, key) => {
        const value = params[key]
        result[key] = value instanceof Date ? value.toISOString() : String(value)
        return result
      }, {} as Record<string, string>)
    
    const paramString = new URLSearchParams(sortedParams).toString()
    return `${prefix}:${Buffer.from(paramString).toString('base64')}`
  }

  // Cache-specific methods for different data types
  
  // Property search caching
  async cacheSearchResults(
    filters: any, 
    results: UnifiedProperty[], 
    source?: PropertySource
  ): Promise<void> {
    // Normalize dates to day precision for better cache hits
    const normalizeDate = (date: Date | string | undefined) => {
      if (!date) return ''
      const d = typeof date === 'string' ? new Date(date) : date
      return d.toISOString().split('T')[0] // YYYY-MM-DD only
    }
    
    const key = this.generateKey(`search:${source || 'all'}`, {
      destination: filters.destination || '',
      checkIn: normalizeDate(filters.checkIn),
      checkOut: normalizeDate(filters.checkOut),
      guests: filters.adults + filters.children,
      page: filters.page,
      limit: filters.limit
    })
    
    await this.set(key, results, 'search')
  }

  async getCachedSearchResults(
    filters: any, 
    source?: PropertySource
  ): Promise<UnifiedProperty[] | null> {
    // Normalize dates to day precision for better cache hits
    const normalizeDate = (date: Date | string | undefined) => {
      if (!date) return ''
      const d = typeof date === 'string' ? new Date(date) : date
      return d.toISOString().split('T')[0] // YYYY-MM-DD only
    }
    
    const key = this.generateKey(`search:${source || 'all'}`, {
      destination: filters.destination || '',
      checkIn: normalizeDate(filters.checkIn),
      checkOut: normalizeDate(filters.checkOut),
      guests: filters.adults + filters.children,
      page: filters.page,
      limit: filters.limit
    })
    
    return this.get<UnifiedProperty[]>(key, 'search')
  }

  // Property details caching
  async cacheProperty(property: UnifiedProperty): Promise<void> {
    const key = `property:${property.id}`
    await this.set(key, property, 'property')
  }

  async getCachedProperty(propertyId: string): Promise<UnifiedProperty | null> {
    const key = `property:${propertyId}`
    return this.get<UnifiedProperty>(key, 'property')
  }

  // Availability caching
  async cacheAvailability(
    propertyId: string, 
    availability: PropertyAvailability[]
  ): Promise<void> {
    const key = `availability:${propertyId}:${availability[0]?.checkIn?.toISOString()?.split('T')[0]}`
    await this.set(key, availability, 'availability')
  }

  async getCachedAvailability(
    propertyId: string, 
    checkIn: Date
  ): Promise<PropertyAvailability[] | null> {
    const key = `availability:${propertyId}:${checkIn.toISOString().split('T')[0]}`
    return this.get<PropertyAvailability[]>(key, 'availability')
  }

  // Rate limiting cache (to track API usage)
  async incrementApiUsage(source: PropertySource): Promise<number> {
    const key = `api_usage:${source}:${new Date().toISOString().split('T')[0]}`
    const current = await this.get<number>(key, 'static') || 0
    const newCount = current + 1
    
    await this.set(key, newCount, 'static', 24 * 60 * 60) // 24 hours
    return newCount
  }

  async getApiUsage(source: PropertySource): Promise<number> {
    const key = `api_usage:${source}:${new Date().toISOString().split('T')[0]}`
    return await this.get<number>(key, 'static') || 0
  }

  // Preemptive cache warming
  async warmCache(popularSearches: Array<{
    destination: string
    checkIn: Date
    checkOut: Date
    guests: number
  }>): Promise<void> {
    console.log('🔥 Starting cache warm-up...')
    
    // This would trigger background searches for popular destinations
    for (const search of popularSearches) {
      const key = this.generateKey('search:all', search)
      const cached = await this.get(key)
      
      if (!cached) {
        console.log(`🔄 Warming cache for ${search.destination}`)
        // Trigger background search (implement based on your search service)
      }
    }
  }

  // Cache statistics
  async getStats(): Promise<{
    memory: any
    redis: any
    performance: {
      hitRate: number
      totalRequests: number
      cacheSize: number
    }
  }> {
    const memoryStats = this.memoryCache.getStats()
    const redisStats = await this.redisCache.getStats()
    
    return {
      memory: memoryStats,
      redis: redisStats,
      performance: {
        hitRate: memoryStats.hitRate,
        totalRequests: memoryStats.entries.reduce((sum, e) => sum + e.accessCount, 0),
        cacheSize: memoryStats.size + (redisStats?.totalKeys || 0)
      }
    }
  }

  // Private helper methods
  private getTtlByType(type: CacheEntry['type']): number {
    return CACHE_CONFIG.ttl[type] || CACHE_CONFIG.ttl.search
  }

  private startCleanupJob(): void {
    // Run cleanup every 10 minutes
    setInterval(() => {
      // Memory cache cleanup happens automatically via LRU
      // Redis cleanup happens automatically via TTL
      console.log('🧹 Cache cleanup job executed')
    }, 10 * 60 * 1000)
  }
}

// Singleton instance
export const cacheService = new CacheService()

// Cache decorators for automatic caching
export function Cached(
  type: CacheEntry['type'], 
  ttl?: number,
  keyGenerator?: (...args: any[]) => string
) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value
    
    descriptor.value = async function (...args: any[]) {
      const cacheKey = keyGenerator 
        ? keyGenerator(...args) 
        : `${target.constructor.name}:${propertyKey}:${JSON.stringify(args)}`
      
      // Try cache first
      const cached = await cacheService.get(cacheKey, type)
      if (cached !== null) {
        return cached
      }
      
      // Execute original method
      const result = await originalMethod.apply(this, args)
      
      // Cache result
      if (result !== null && result !== undefined) {
        await cacheService.set(cacheKey, result, type, ttl)
      }
      
      return result
    }
    
    return descriptor
  }
}

// Cache warming utilities
export const CacheWarmer = {
  // Pre-populate cache with popular searches
  async warmPopularDestinations(): Promise<void> {
    const popular = [
      { destination: 'Rio de Janeiro', checkIn: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), checkOut: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), guests: 2 },
      { destination: 'São Paulo', checkIn: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), checkOut: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), guests: 2 },
      { destination: 'Florianópolis', checkIn: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), checkOut: new Date(Date.now() + 17 * 24 * 60 * 60 * 1000), guests: 4 },
    ]
    
    await cacheService.warmCache(popular)
  },

  // Pre-cache property details for trending properties
  async warmTrendingProperties(propertyIds: string[]): Promise<void> {
    console.log('🔥 Warming trending properties cache...')
    
    for (const propertyId of propertyIds) {
      const cached = await cacheService.getCachedProperty(propertyId)
      if (!cached) {
        console.log(`🔄 Need to cache property: ${propertyId}`)
        // Would trigger property fetch in background
      }
    }
  }
}
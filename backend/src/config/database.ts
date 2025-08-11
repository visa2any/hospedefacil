import { PrismaClient } from '@prisma/client'
import { config } from './environment.js'

declare global {
  var __prisma: PrismaClient | undefined
}

const createPrismaClient = () => {
  return new PrismaClient({
    log: config.NODE_ENV === 'development' 
      ? ['query', 'error', 'warn']
      : ['error'],
    datasources: {
      db: {
        url: config.DATABASE_URL,
      },
    },
  })
}

export const prisma = globalThis.__prisma ?? createPrismaClient()

if (config.NODE_ENV === 'development') {
  globalThis.__prisma = prisma
}

// Connection management
export async function connectDatabase() {
  try {
    await prisma.$connect()
    console.log('✅ Conectado ao banco de dados PostgreSQL')
  } catch (error) {
    console.error('❌ Erro ao conectar ao banco de dados:', error)
    process.exit(1)
  }
}

export async function disconnectDatabase() {
  await prisma.$disconnect()
  console.log('🔌 Desconectado do banco de dados')
}

// Health check
export async function checkDatabaseHealth() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return { status: 'healthy' }
  } catch (error) {
    return { status: 'unhealthy', error: error.message }
  }
}

// Database utilities
export async function resetDatabase() {
  if (config.NODE_ENV === 'production') {
    throw new Error('Cannot reset database in production')
  }
  
  // Clear all data in development
  const tablenames = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname='public'
  `
  
  for (const { tablename } of tablenames) {
    if (tablename !== '_prisma_migrations') {
      try {
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE "public"."${tablename}" CASCADE;`)
      } catch (error) {
        console.log(`Could not truncate ${tablename}`)
      }
    }
  }
}

// Seed data function
export async function seedDatabase() {
  console.log('🌱 Criando dados iniciais...')
  
  // Create default amenities
  const amenities = [
    { name: 'Wi-Fi', nameEn: 'Wi-Fi', icon: 'wifi', category: 'essentials' },
    { name: 'Cozinha', nameEn: 'Kitchen', icon: 'chef-hat', category: 'essentials' },
    { name: 'Ar condicionado', nameEn: 'Air conditioning', icon: 'thermometer', category: 'comfort' },
    { name: 'TV', nameEn: 'TV', icon: 'tv', category: 'entertainment' },
    { name: 'Piscina', nameEn: 'Pool', icon: 'waves', category: 'outdoor' },
    { name: 'Academia', nameEn: 'Gym', icon: 'dumbbell', category: 'facilities' },
    { name: 'Estacionamento', nameEn: 'Parking', icon: 'car', category: 'convenience' },
    { name: 'Animais permitidos', nameEn: 'Pet friendly', icon: 'heart', category: 'policies' },
    { name: 'Café da manhã', nameEn: 'Breakfast', icon: 'coffee', category: 'services' },
    { name: 'Lava e seca', nameEn: 'Washer & Dryer', icon: 'shirt', category: 'convenience' },
  ]
  
  for (const amenity of amenities) {
    await prisma.amenity.upsert({
      where: { name: amenity.name },
      update: {},
      create: amenity,
    })
  }
  
  // Create system settings
  const settings = [
    { key: 'platform_fee', value: '0.10', type: 'number' },
    { key: 'host_fee', value: '0.03', type: 'number' },
    { key: 'min_booking_days', value: '1', type: 'number' },
    { key: 'max_booking_days', value: '90', type: 'number' },
    { key: 'cancellation_window_hours', value: '24', type: 'number' },
    { key: 'auto_accept_bookings', value: 'false', type: 'boolean' },
    { key: 'maintenance_mode', value: 'false', type: 'boolean' },
    { key: 'supported_currencies', value: '["BRL","USD","EUR"]', type: 'json' },
  ]
  
  for (const setting of settings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: setting,
    })
  }
  
  console.log('✅ Dados iniciais criados com sucesso!')
}

// Error handling for database operations
export function handleDatabaseError(error: any) {
  if (error.code === 'P2002') {
    return {
      type: 'UNIQUE_CONSTRAINT_ERROR',
      message: 'Este valor já existe no sistema',
      field: error.meta?.target?.[0],
    }
  }
  
  if (error.code === 'P2025') {
    return {
      type: 'RECORD_NOT_FOUND',
      message: 'Registro não encontrado',
    }
  }
  
  if (error.code === 'P2003') {
    return {
      type: 'FOREIGN_KEY_ERROR',
      message: 'Referência inválida',
    }
  }
  
  return {
    type: 'DATABASE_ERROR',
    message: 'Erro interno do banco de dados',
  }
}
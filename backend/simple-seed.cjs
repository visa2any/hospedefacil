// Simple JavaScript seed for database
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting seed...')
  
  // Create admin user
  const adminUser = await prisma.user.create({
    data: {
      name: 'Admin HospedeFácil',
      email: 'admin@hospedefacil.com.br',
      password: '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password
      role: 'ADMIN',
      status: 'ACTIVE',
      emailVerified: true,
      phoneVerified: true,
      documentVerified: true
    }
  })

  // Create a few sample properties
  const property1 = await prisma.property.create({
    data: {
      hostId: adminUser.id,
      title: 'Apartamento Copa Ipanema',
      description: 'Lindo apartamento próximo à praia de Ipanema',
      type: 'APARTMENT',
      status: 'ACTIVE',
      address: 'Rua Visconde de Pirajá',
      city: 'Rio de Janeiro',
      state: 'RJ',
      zipCode: '22410-000',
      country: 'Brasil',
      latitude: -22.9068,
      longitude: -43.1729,
      maxGuests: 4,
      bedrooms: 2,
      bathrooms: 2,
      basePrice: 250.00,
      currency: 'BRL'
    }
  })

  console.log('✅ Seed completed successfully!')
  console.log(`Created user: ${adminUser.email}`)
  console.log(`Created property: ${property1.title}`)
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
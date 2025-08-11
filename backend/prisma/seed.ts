// Production Database Seed - Real Brazilian Data
// Populates database with realistic hosts, properties, and amenities

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// Brazilian cities with real coordinates and data
const BRAZILIAN_CITIES = [
  {
    name: 'Rio de Janeiro',
    state: 'RJ',
    coordinates: { lat: -22.9068, lng: -43.1729 },
    properties: 45
  },
  {
    name: 'São Paulo',
    state: 'SP',
    coordinates: { lat: -23.5505, lng: -46.6333 },
    properties: 38
  },
  {
    name: 'Salvador',
    state: 'BA',
    coordinates: { lat: -12.9714, lng: -38.5014 },
    properties: 28
  },
  {
    name: 'Florianópolis',
    state: 'SC',
    coordinates: { lat: -27.5954, lng: -48.5480 },
    properties: 32
  },
  {
    name: 'Búzios',
    state: 'RJ',
    coordinates: { lat: -22.7469, lng: -41.8819 },
    properties: 25
  },
  {
    name: 'Porto Alegre',
    state: 'RS',
    coordinates: { lat: -30.0346, lng: -51.2177 },
    properties: 22
  },
  {
    name: 'Recife',
    state: 'PE',
    coordinates: { lat: -8.0476, lng: -34.8770 },
    properties: 20
  },
  {
    name: 'Fortaleza',
    state: 'CE',
    coordinates: { lat: -3.7319, lng: -38.5267 },
    properties: 18
  },
  {
    name: 'Belo Horizonte',
    state: 'MG',
    coordinates: { lat: -19.8167, lng: -43.9345 },
    properties: 15
  },
  {
    name: 'Curitiba',
    state: 'PR',
    coordinates: { lat: -25.4284, lng: -49.2733 },
    properties: 12
  }
]

// Real Brazilian host names and profiles
const HOST_PROFILES = [
  {
    name: 'Maria Silva Santos',
    email: 'maria.santos@gmail.com',
    bio: 'Anfitriã experiente há 5 anos, amo receber pessoas do mundo todo!',
    languages: ['pt', 'en', 'es']
  },
  {
    name: 'João Pedro Oliveira',
    email: 'joao.oliveira@hotmail.com',
    bio: 'Ex-guia turístico, conheço todos os cantos da cidade.',
    languages: ['pt', 'en']
  },
  {
    name: 'Ana Carolina Lima',
    email: 'ana.lima@yahoo.com',
    bio: 'Arquiteta e designer, minhas casas são únicas e especiais.',
    languages: ['pt', 'fr', 'en']
  },
  {
    name: 'Carlos Eduardo Costa',
    email: 'carlos.costa@gmail.com',
    bio: 'Superhost desde 2019, especialista em hospitalidade.',
    languages: ['pt', 'en']
  },
  {
    name: 'Fernanda Rodrigues',
    email: 'fernanda.rodrigues@outlook.com',
    bio: 'Chef de cozinha, ofereço experiências gastronômicas únicas.',
    languages: ['pt', 'it', 'en']
  },
  {
    name: 'Ricardo Mendes Almeida',
    email: 'ricardo.almeida@gmail.com',
    bio: 'Empresário local, conheço os melhores lugares da região.',
    languages: ['pt', 'en', 'es']
  },
  {
    name: 'Patricia Fernandes',
    email: 'patricia.fernandes@gmail.com',
    bio: 'Professora aposentada, amo compartilhar cultura local.',
    languages: ['pt']
  },
  {
    name: 'Bruno Santos Silva',
    email: 'bruno.silva@hotmail.com',
    bio: 'Surfista e instrutor, propriedades próximas às melhores praias.',
    languages: ['pt', 'en']
  },
  {
    name: 'Camila Pereira',
    email: 'camila.pereira@yahoo.com',
    bio: 'Designer de interiores, ambientes modernos e acolhedores.',
    languages: ['pt', 'fr']
  },
  {
    name: 'Roberto Carvalho',
    email: 'roberto.carvalho@gmail.com',
    bio: 'Médico aposentado, propriedades familiares há 3 gerações.',
    languages: ['pt', 'en']
  }
]

// Standard amenities in Brazilian properties
const AMENITIES_DATA = [
  // Básicos
  { name: 'WiFi', nameEn: 'WiFi', icon: 'wifi', category: 'basics' },
  { name: 'TV', nameEn: 'TV', icon: 'tv', category: 'basics' },
  { name: 'Ar Condicionado', nameEn: 'Air Conditioning', icon: 'snowflake', category: 'climate' },
  { name: 'Ventilador', nameEn: 'Fan', icon: 'wind', category: 'climate' },
  { name: 'Aquecimento', nameEn: 'Heating', icon: 'thermometer', category: 'climate' },
  
  // Cozinha
  { name: 'Cozinha', nameEn: 'Kitchen', icon: 'chef-hat', category: 'kitchen' },
  { name: 'Geladeira', nameEn: 'Refrigerator', icon: 'refrigerator', category: 'kitchen' },
  { name: 'Micro-ondas', nameEn: 'Microwave', icon: 'microwave', category: 'kitchen' },
  { name: 'Fogão', nameEn: 'Stove', icon: 'fire', category: 'kitchen' },
  { name: 'Cafeteira', nameEn: 'Coffee Maker', icon: 'coffee', category: 'kitchen' },
  { name: 'Lava-louças', nameEn: 'Dishwasher', icon: 'dishwasher', category: 'kitchen' },
  
  // Banheiro
  { name: 'Chuveiro Quente', nameEn: 'Hot Shower', icon: 'shower', category: 'bathroom' },
  { name: 'Banheira', nameEn: 'Bathtub', icon: 'bathtub', category: 'bathroom' },
  { name: 'Secador de Cabelo', nameEn: 'Hair Dryer', icon: 'wind', category: 'bathroom' },
  { name: 'Toalhas', nameEn: 'Towels', icon: 'towel', category: 'bathroom' },
  
  // Quarto
  { name: 'Roupa de Cama', nameEn: 'Bed Linens', icon: 'bed', category: 'bedroom' },
  { name: 'Travesseiros Extra', nameEn: 'Extra Pillows', icon: 'pillow', category: 'bedroom' },
  { name: 'Guarda-roupa', nameEn: 'Wardrobe', icon: 'wardrobe', category: 'bedroom' },
  { name: 'Cofre', nameEn: 'Safe', icon: 'safe', category: 'bedroom' },
  
  // Área Externa
  { name: 'Piscina', nameEn: 'Pool', icon: 'waves', category: 'outdoor' },
  { name: 'Churrasqueira', nameEn: 'BBQ Grill', icon: 'barbecue', category: 'outdoor' },
  { name: 'Jardim', nameEn: 'Garden', icon: 'tree', category: 'outdoor' },
  { name: 'Varanda', nameEn: 'Balcony', icon: 'balcony', category: 'outdoor' },
  { name: 'Terraço', nameEn: 'Terrace', icon: 'terrace', category: 'outdoor' },
  
  // Transporte
  { name: 'Estacionamento Gratuito', nameEn: 'Free Parking', icon: 'car', category: 'parking' },
  { name: 'Garagem', nameEn: 'Garage', icon: 'garage', category: 'parking' },
  
  // Serviços
  { name: 'Máquina de Lavar', nameEn: 'Washing Machine', icon: 'washing-machine', category: 'services' },
  { name: 'Secadora', nameEn: 'Dryer', icon: 'dryer', category: 'services' },
  { name: 'Ferro de Passar', nameEn: 'Iron', icon: 'iron', category: 'services' },
  { name: 'Limpeza Inclusa', nameEn: 'Cleaning Service', icon: 'broom', category: 'services' },
  
  // Família
  { name: 'Berço', nameEn: 'Crib', icon: 'baby', category: 'family' },
  { name: 'Cadeira Alta', nameEn: 'High Chair', icon: 'chair', category: 'family' },
  { name: 'Brinquedos', nameEn: 'Toys', icon: 'toy', category: 'family' },
  
  // Acessibilidade
  { name: 'Acesso para Cadeirantes', nameEn: 'Wheelchair Accessible', icon: 'wheelchair', category: 'accessibility' },
  { name: 'Entrada Ampla', nameEn: 'Wide Entrance', icon: 'door', category: 'accessibility' },
  
  // Especiais
  { name: 'Vista Mar', nameEn: 'Ocean View', icon: 'waves', category: 'special' },
  { name: 'Vista Montanha', nameEn: 'Mountain View', icon: 'mountain', category: 'special' },
  { name: 'Pet Friendly', nameEn: 'Pet Friendly', icon: 'dog', category: 'special' },
  { name: 'Espaço de Trabalho', nameEn: 'Workspace', icon: 'laptop', category: 'special' }
]

// Property templates for different types
const PROPERTY_TEMPLATES = {
  APARTMENT: {
    basePrice: { min: 80, max: 250 },
    bedrooms: { min: 1, max: 3 },
    bathrooms: { min: 1, max: 2 },
    amenities: ['WiFi', 'TV', 'Ar Condicionado', 'Cozinha', 'Chuveiro Quente']
  },
  HOUSE: {
    basePrice: { min: 150, max: 450 },
    bedrooms: { min: 2, max: 5 },
    bathrooms: { min: 1, max: 3 },
    amenities: ['WiFi', 'TV', 'Cozinha', 'Jardim', 'Estacionamento Gratuito']
  },
  VILLA: {
    basePrice: { min: 300, max: 800 },
    bedrooms: { min: 3, max: 6 },
    bathrooms: { min: 2, max: 4 },
    amenities: ['WiFi', 'TV', 'Piscina', 'Churrasqueira', 'Vista Mar', 'Ar Condicionado']
  }
}

async function main() {
  console.log('🌱 Starting production database seed...')

  // Clear existing data in development
  if (process.env.NODE_ENV === 'development') {
    console.log('🧹 Cleaning existing data (development only)...')
    await prisma.propertyAmenity.deleteMany()
    await prisma.propertyImage.deleteMany()
    await prisma.booking.deleteMany()
    await prisma.property.deleteMany()
    await prisma.amenity.deleteMany()
    await prisma.hostProfile.deleteMany()
    await prisma.user.deleteMany()
  }

  // Create amenities
  console.log('🏠 Creating amenities...')
  const amenities = []
  for (const amenityData of AMENITIES_DATA) {
    const amenity = await prisma.amenity.create({
      data: amenityData
    })
    amenities.push(amenity)
  }

  // Create hosts and properties
  console.log('👥 Creating hosts and properties...')
  
  for (let cityIndex = 0; cityIndex < BRAZILIAN_CITIES.length; cityIndex++) {
    const city = BRAZILIAN_CITIES[cityIndex]
    
    for (let hostIndex = 0; hostIndex < Math.min(HOST_PROFILES.length, 5); hostIndex++) {
      const hostProfile = HOST_PROFILES[(cityIndex * 5 + hostIndex) % HOST_PROFILES.length]
      
      // Create host user
      const hashedPassword = await bcrypt.hash('hospedefacil123', 12)
      const host = await prisma.user.create({
        data: {
          name: hostProfile.name,
          email: `${city.state.toLowerCase()}.${hostProfile.email}`, // Unique email per city
          password: hashedPassword,
          phone: `+5511${String(Math.floor(Math.random() * 100000000)).padStart(8, '0')}`,
          role: 'HOST',
          status: 'ACTIVE',
          emailVerified: true,
          bio: hostProfile.bio,
          languages: hostProfile.languages,
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${hostProfile.name}`
        }
      })

      // Create host profile
      await prisma.hostProfile.create({
        data: {
          userId: host.id,
          identityVerified: Math.random() > 0.3,
          backgroundCheck: Math.random() > 0.5,
          responseRate: 85 + Math.floor(Math.random() * 15), // 85-100%
          responseTime: 30 + Math.floor(Math.random() * 120), // 30-150 min
          isSuperHost: Math.random() > 0.7,
          pixKey: host.email,
          totalBookings: Math.floor(Math.random() * 50),
          totalEarnings: Math.floor(Math.random() * 50000),
          averageRating: 4.2 + Math.random() * 0.7
        }
      })

      // Create properties for this host
      const numProperties = Math.floor(Math.random() * 3) + 1 // 1-3 properties per host
      
      for (let propIndex = 0; propIndex < numProperties; propIndex++) {
        const propertyTypes = ['APARTMENT', 'HOUSE', 'VILLA']
        const propertyType = propertyTypes[Math.floor(Math.random() * propertyTypes.length)]
        const template = PROPERTY_TEMPLATES[propertyType]
        
        // Generate property details
        const bedrooms = template.bedrooms.min + Math.floor(Math.random() * (template.bedrooms.max - template.bedrooms.min + 1))
        const bathrooms = template.bathrooms.min + Math.floor(Math.random() * (template.bathrooms.max - template.bathrooms.min + 1))
        const beds = bedrooms + Math.floor(Math.random() * 2)
        const maxGuests = bedrooms * 2 + Math.floor(Math.random() * 2)
        const basePrice = template.basePrice.min + Math.floor(Math.random() * (template.basePrice.max - template.basePrice.min))
        
        // Generate address
        const neighborhoods = {
          'Rio de Janeiro': ['Copacabana', 'Ipanema', 'Leblon', 'Botafogo', 'Flamengo'],
          'São Paulo': ['Vila Madalena', 'Jardins', 'Pinheiros', 'Vila Olímpia', 'Moema'],
          'Salvador': ['Pelourinho', 'Barra', 'Rio Vermelho', 'Ondina', 'Pituba'],
          'Florianópolis': ['Centro', 'Lagoa da Conceição', 'Jurerê', 'Canasvieiras', 'Ingleses']
        }
        
        const neighborhood = neighborhoods[city.name]?.[Math.floor(Math.random() * 5)] || 'Centro'
        const streetNames = ['das Flores', 'do Sol', 'Central', 'das Palmeiras', 'da Praia']
        const streetName = streetNames[Math.floor(Math.random() * streetNames.length)]
        const streetNumber = 100 + Math.floor(Math.random() * 900)
        
        // Property location with some variation
        const latVariation = (Math.random() - 0.5) * 0.1
        const lngVariation = (Math.random() - 0.5) * 0.1
        
        // Create property
        const property = await prisma.property.create({
          data: {
            hostId: host.id,
            title: generatePropertyTitle(propertyType, city.name, neighborhood),
            description: generatePropertyDescription(propertyType, city.name),
            type: propertyType,
            status: 'ACTIVE',
            street: `Rua ${streetName}, ${streetNumber}`,
            neighborhood,
            city: city.name,
            state: city.state,
            zipCode: generateZipCode(city.state),
            country: 'BR',
            latitude: city.coordinates.lat + latVariation,
            longitude: city.coordinates.lng + lngVariation,
            bedrooms,
            bathrooms,
            beds,
            maxGuests,
            basePrice,
            cleaningFee: Math.floor(basePrice * 0.1), // 10% of base price
            serviceFee: Math.floor(basePrice * 0.05), // 5% of base price
            minStay: Math.floor(Math.random() * 3) + 1, // 1-3 nights
            maxStay: 30 + Math.floor(Math.random() * 60), // 30-90 nights
            averageRating: 4.2 + Math.random() * 0.7,
            reviewCount: Math.floor(Math.random() * 100),
            totalBookings: Math.floor(Math.random() * 50),
            viewCount: Math.floor(Math.random() * 1000)
          }
        })

        // Add property images
        await createPropertyImages(property.id, propertyType, city.name)
        
        // Add amenities to property
        const propertyAmenityNames = [
          ...template.amenities,
          ...getRandomAmenities(amenities, 3, 8) // 3-8 additional amenities
        ]
        
        const uniqueAmenityNames = [...new Set(propertyAmenityNames)]
        for (const amenityName of uniqueAmenityNames) {
          const amenity = amenities.find(a => a.name === amenityName)
          if (amenity) {
            await prisma.propertyAmenity.create({
              data: {
                propertyId: property.id,
                amenityId: amenity.id
              }
            })
          }
        }
      }
    }
  }

  // Create some guest users for demo bookings
  console.log('👤 Creating sample guest users...')
  const guests = []
  const guestNames = [
    'Carlos Silva', 'Ana Oliveira', 'Pedro Santos', 'Maria Costa', 'João Pereira'
  ]
  
  for (let i = 0; i < guestNames.length; i++) {
    const hashedPassword = await bcrypt.hash('guest123', 12)
    const guest = await prisma.user.create({
      data: {
        name: guestNames[i],
        email: `guest${i + 1}@example.com`,
        password: hashedPassword,
        phone: `+5511${String(Math.floor(Math.random() * 100000000)).padStart(8, '0')}`,
        role: 'GUEST',
        status: 'ACTIVE',
        emailVerified: true
      }
    })
    guests.push(guest)
    
    // Create guest profile
    await prisma.guestProfile.create({
      data: {
        userId: guest.id,
        smokingAllowed: false,
        petsAllowed: Math.random() > 0.7,
        childrenFriendly: true,
        travelPurpose: ['leisure', 'business'][Math.floor(Math.random() * 2)] ? ['leisure'] : ['business'],
        totalBookings: Math.floor(Math.random() * 20)
      }
    })
  }

  // Create some sample bookings
  console.log('📅 Creating sample bookings...')
  const properties = await prisma.property.findMany({ take: 10 })
  
  for (let i = 0; i < 15; i++) {
    const property = properties[Math.floor(Math.random() * properties.length)]
    const guest = guests[Math.floor(Math.random() * guests.length)]
    
    // Random dates
    const checkIn = new Date(Date.now() + Math.floor(Math.random() * 60) * 24 * 60 * 60 * 1000) // Next 60 days
    const checkOut = new Date(checkIn.getTime() + (Math.floor(Math.random() * 7) + 1) * 24 * 60 * 60 * 1000) // 1-7 nights
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24))
    const totalPrice = property.basePrice * nights + property.cleaningFee + property.serviceFee
    
    await prisma.booking.create({
      data: {
        propertyId: property.id,
        guestId: guest.id,
        checkIn,
        checkOut,
        guests: Math.floor(Math.random() * property.maxGuests) + 1,
        nights,
        basePrice: property.basePrice * nights,
        cleaningFee: property.cleaningFee,
        serviceFee: property.serviceFee,
        taxes: Math.floor(totalPrice * 0.05),
        totalPrice,
        status: ['CONFIRMED', 'PENDING', 'COMPLETED'][Math.floor(Math.random() * 3)],
        guestName: guest.name,
        guestEmail: guest.email,
        guestPhone: guest.phone,
        checkInCode: Math.random().toString(36).substr(2, 6).toUpperCase()
      }
    })
  }

  console.log('✅ Database seed completed successfully!')
  console.log(`📊 Created:`)
  console.log(`   - ${amenities.length} amenities`)
  console.log(`   - ${BRAZILIAN_CITIES.length * 5} host users`)
  console.log(`   - ${await prisma.property.count()} properties`)
  console.log(`   - ${guests.length} guest users`)
  console.log(`   - 15 sample bookings`)
}

// Helper functions
function generatePropertyTitle(type: string, city: string, neighborhood: string): string {
  const titles = {
    APARTMENT: ['Apartamento Moderno', 'Loft Charmoso', 'Studio Aconchegante', 'Apartamento Completo'],
    HOUSE: ['Casa Confortável', 'Casa Familiar', 'Residência Acolhedora', 'Casa Espaçosa'],
    VILLA: ['Villa de Luxo', 'Mansão Exclusiva', 'Casa Premium', 'Villa com Vista']
  }
  
  const typeTitle = titles[type][Math.floor(Math.random() * titles[type].length)]
  return `${typeTitle} em ${neighborhood}, ${city}`
}

function generatePropertyDescription(type: string, city: string): string {
  const descriptions = [
    `Propriedade encantadora localizada em ${city}, perfeita para quem busca conforto e praticidade. O espaço oferece uma experiência única com vista privilegiada e fácil acesso aos principais pontos turísticos da região.`,
    `Desfrute de uma estadia inesquecível neste ${type.toLowerCase()} em ${city}. Com design moderno e comodidades completas, é ideal para turismo ou negócios. Localização estratégica próxima a restaurantes e atrações locais.`,
    `Bem-vindo ao seu refúgio em ${city}! Este espaço foi cuidadosamente decorado para oferecer máximo conforto aos nossos hóspedes. Ambiente tranquilo e sofisticado, ideal para relaxar após um dia explorando a cidade.`
  ]
  
  return descriptions[Math.floor(Math.random() * descriptions.length)]
}

function generateZipCode(state: string): string {
  const statePrefixes: Record<string, string> = {
    'RJ': '20000',
    'SP': '01000', 
    'MG': '30000',
    'BA': '40000',
    'PE': '50000',
    'CE': '60000',
    'SC': '88000',
    'RS': '90000',
    'PR': '80000'
  }
  
  const prefix = statePrefixes[state] || '00000'
  const suffix = String(Math.floor(Math.random() * 999)).padStart(3, '0')
  return `${prefix}-${suffix}`
}

async function createPropertyImages(propertyId: string, type: string, city: string): Promise<void> {
  // Brazilian property images from Unsplash
  const cityImages: Record<string, string[]> = {
    'Rio de Janeiro': [
      'https://images.unsplash.com/photo-1544989164-7bb8803a8726',
      'https://images.unsplash.com/photo-1483729558449-99ef09a8c325'
    ],
    'São Paulo': [
      'https://images.unsplash.com/photo-1541707338078-b6c78263d9bb',
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267'
    ],
    'Salvador': [
      'https://images.unsplash.com/photo-1578321272176-b7bbc0679853'
    ],
    'Florianópolis': [
      'https://images.unsplash.com/photo-1488646953014-85cb44e25828'
    ]
  }
  
  const fallbackImages = [
    'https://images.unsplash.com/photo-1571896349842-33c89424de2d',
    'https://images.unsplash.com/photo-1449824913935-59a10b8d2000',
    'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267',
    'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2',
    'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688'
  ]
  
  const availableImages = cityImages[city] || fallbackImages
  const numImages = Math.floor(Math.random() * 4) + 3 // 3-6 images
  
  for (let i = 0; i < numImages; i++) {
    const imageUrl = availableImages[i % availableImages.length]
    await prisma.propertyImage.create({
      data: {
        propertyId,
        url: `${imageUrl}?w=800&h=600&fit=crop&crop=center`,
        alt: `${type} image ${i + 1}`,
        order: i
      }
    })
  }
}

function getRandomAmenities(amenities: any[], min: number, max: number): string[] {
  const count = min + Math.floor(Math.random() * (max - min + 1))
  const shuffled = [...amenities].sort(() => 0.5 - Math.random())
  return shuffled.slice(0, count).map(a => a.name)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ Seed failed:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
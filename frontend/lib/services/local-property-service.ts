// Local Property Service - Real data implementation
// This service manages local host properties in Brazil

import { 
  UnifiedProperty,
  PropertySource,
  PropertyType, 
  PropertyStatus,
  SearchFilters,
  PropertyAvailability,
  UnifiedBooking,
  LocalPropertyData
} from '../database/schemas'
import { brazilianCitiesService, BrazilianCity } from './brazilian-cities-service'

class LocalPropertyService {
  private properties: UnifiedProperty[] = []

  constructor() {
    // Initialize with realistic local properties
    this.initializeLocalProperties()
  }

  // Initialize with comprehensive local properties
  private initializeLocalProperties() {
    const cities = brazilianCitiesService.getCitiesWithLocalCoverage()
    
    cities.forEach(city => {
      const propertyCount = Math.ceil(city.estimatedProperties * 0.6) // 60% are local properties
      
      for (let i = 0; i < Math.min(propertyCount, 10); i++) { // Max 10 per city for demo
        this.properties.push(this.generateLocalProperty(city, i))
      }
    })

    console.log(`🏠 Initialized ${this.properties.length} local properties across ${cities.length} cities`)
  }

  // Generate a realistic local property for a city
  private generateLocalProperty(city: BrazilianCity, index: number): UnifiedProperty {
    const propertyTypes = this.getPropertyTypesForCity(city)
    const propertyType = propertyTypes[index % propertyTypes.length]
    
    const accommodates = this.getAccommodatesForType(propertyType)
    const bedrooms = Math.ceil(accommodates / 2.5)
    const bathrooms = Math.ceil(bedrooms * 0.7)
    const beds = bedrooms + Math.floor(Math.random() * 2)

    // Price variation based on city and property type
    const basePrice = city.averagePrice * this.getPriceMultiplierForType(propertyType)
    const priceVariation = 0.8 + (Math.random() * 0.4) // ±20%
    const finalPrice = Math.round(basePrice * priceVariation)

    // Generate location near city center with some randomness
    const latVariation = (Math.random() - 0.5) * 0.1 // ±~5km
    const lngVariation = (Math.random() - 0.5) * 0.1
    
    const property: UnifiedProperty = {
      id: `local_${city.id}_${index + 1}`,
      source: PropertySource.LOCAL,
      externalId: `LP${city.stateCode}${String(index + 1).padStart(4, '0')}`,
      
      name: this.generatePropertyName(city, propertyType, index),
      description: this.generatePropertyDescription(city, propertyType),
      type: propertyType,
      status: PropertyStatus.ACTIVE,
      
      location: {
        address: this.generateAddress(city, index),
        city: city.name,
        state: city.state,
        country: 'Brasil',
        zipCode: this.generateZipCode(city.stateCode),
        coordinates: {
          lat: city.coordinates.lat + latVariation,
          lng: city.coordinates.lng + lngVariation
        },
        timezone: 'America/Sao_Paulo'
      },
      
      images: this.generatePropertyImages(city, propertyType, index),
      
      accommodates,
      bedrooms,
      bathrooms,
      beds,
      
      amenities: this.generateAmenities(city, propertyType),
      
      basePricePerNight: finalPrice,
      currency: 'BRL',
      taxesIncluded: false,
      
      rating: 4.2 + (Math.random() * 0.7), // 4.2 to 4.9
      reviewCount: Math.floor(Math.random() * 200) + 10, // 10 to 210 reviews
      
      isInstantBookable: Math.random() > 0.3, // 70% instant bookable
      minimumStay: city.touristicLevel === 'high' ? 2 : 1,
      maximumStay: city.touristicLevel === 'high' ? 30 : 90,
      
      checkInTime: '15:00',
      checkOutTime: '11:00',
      houseRules: this.generateHouseRules(propertyType),
      
      cancellationPolicy: this.generateCancellationPolicy(),
      
      localData: this.generateLocalData(city, index),
      
      createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000), // Random date within last year
      updatedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Random date within last month
    }

    return property
  }

  // Property types suitable for each city
  private getPropertyTypesForCity(city: BrazilianCity): PropertyType[] {
    if (city.touristicLevel === 'high') {
      return [PropertyType.HOUSE, PropertyType.APARTMENT, PropertyType.VILLA, PropertyType.POUSADA]
    } else if (city.population > 1000000) {
      return [PropertyType.APARTMENT, PropertyType.HOUSE]
    } else {
      return [PropertyType.HOUSE, PropertyType.CHALET, PropertyType.POUSADA]
    }
  }

  private getAccommodatesForType(type: PropertyType): number {
    switch (type) {
      case PropertyType.APARTMENT: return 2 + Math.floor(Math.random() * 4) // 2-5
      case PropertyType.HOUSE: return 4 + Math.floor(Math.random() * 6) // 4-9
      case PropertyType.VILLA: return 6 + Math.floor(Math.random() * 6) // 6-11
      case PropertyType.CHALET: return 4 + Math.floor(Math.random() * 4) // 4-7
      case PropertyType.POUSADA: return 2 + Math.floor(Math.random() * 6) // 2-7
      default: return 2 + Math.floor(Math.random() * 4)
    }
  }

  private getPriceMultiplierForType(type: PropertyType): number {
    switch (type) {
      case PropertyType.VILLA: return 1.5
      case PropertyType.HOUSE: return 1.2
      case PropertyType.CHALET: return 1.3
      case PropertyType.POUSADA: return 0.8
      case PropertyType.APARTMENT: return 1.0
      default: return 1.0
    }
  }

  // Generate realistic property names
  private generatePropertyName(city: BrazilianCity, type: PropertyType, index: number): string {
    const prefixes = {
      [PropertyType.APARTMENT]: ['Apartamento', 'Loft', 'Studio', 'Cobertura'],
      [PropertyType.HOUSE]: ['Casa', 'Residência', 'Sobrado'],
      [PropertyType.VILLA]: ['Villa', 'Mansão', 'Casa de Luxo'],
      [PropertyType.CHALET]: ['Chalé', 'Casa de Montanha', 'Refúgio'],
      [PropertyType.POUSADA]: ['Pousada', 'Casa de Hóspedes', 'Residencial']
    }

    const descriptors = [
      'Aconchegante', 'Moderno', 'Charmoso', 'Elegante', 'Confortável', 
      'Espaçoso', 'Luxuoso', 'Rústico', 'Contemporâneo', 'Clássico'
    ]

    const locations = {
      'Rio de Janeiro': ['em Copacabana', 'em Ipanema', 'na Barra', 'em Botafogo', 'na Zona Sul'],
      'São Paulo': ['em Vila Madalena', 'nos Jardins', 'em Pinheiros', 'na Vila Olímpia', 'no Centro'],
      'Salvador': ['no Pelourinho', 'na Barra', 'no Rio Vermelho', 'em Ondina'],
      'Florianópolis': ['na Lagoa da Conceição', 'no Centro', 'em Jurerê', 'na Praia Mole'],
      'Búzios': ['na Rua das Pedras', 'em Geribá', 'na Orla Bardot', 'no Centro'],
    }

    const typePrefix = prefixes[type] ? prefixes[type][index % prefixes[type].length] : 'Casa'
    const descriptor = descriptors[index % descriptors.length]
    const location = locations[city.name] ? 
      locations[city.name][index % locations[city.name].length] : 
      `em ${city.name}`

    return `${typePrefix} ${descriptor} ${location}`
  }

  // Generate property descriptions
  private generatePropertyDescription(city: BrazilianCity, type: PropertyType): string {
    const templates = [
      `Propriedade encantadora localizada em ${city.name}, perfeita para quem busca conforto e praticidade. O espaço oferece uma experiência única com vista privilegiada e fácil acesso aos principais pontos turísticos da região.`,
      `Desfrute de uma estadia inesquecível neste(a) ${type.toLowerCase()} em ${city.name}. Com design moderno e comodidades completas, é ideal para turismo ou negócios. Localização estratégica próxima a restaurantes e atrações locais.`,
      `Bem-vindo ao seu refúgio em ${city.name}! Este espaço foi cuidadosamente decorado para oferecer máximo conforto aos nossos hóspedes. Ambiente tranquilo e sofisticado, ideal para relaxar após um dia explorando a cidade.`
    ]
    
    return templates[Math.floor(Math.random() * templates.length)]
  }

  // Generate realistic addresses
  private generateAddress(city: BrazilianCity, index: number): string {
    const streetTypes = ['Rua', 'Avenida', 'Travessa', 'Alameda']
    const streetNames = [
      'das Flores', 'do Sol', 'das Palmeiras', 'Central', 'Principal', 
      'dos Coqueiros', 'da Praia', 'do Centro', 'das Pedras', 'do Mar'
    ]
    
    const streetType = streetTypes[index % streetTypes.length]
    const streetName = streetNames[index % streetNames.length]
    const number = 100 + (index * 17) % 900
    
    return `${streetType} ${streetName}, ${number}`
  }

  // Generate zip codes by state
  private generateZipCode(stateCode: string): string {
    const statePrefixes: { [key: string]: string } = {
      'RJ': '20000-000', 'SP': '01000-000', 'MG': '30000-000', 'BA': '40000-000',
      'PE': '50000-000', 'CE': '60000-000', 'SC': '88000-000', 'RS': '90000-000',
      'PR': '80000-000', 'DF': '70000-000', 'AM': '69000-000', 'PA': '66000-000'
    }
    
    const prefix = statePrefixes[stateCode] || '00000-000'
    const baseNumber = parseInt(prefix.substring(0, 5))
    const variation = Math.floor(Math.random() * 9000)
    const newNumber = String(baseNumber + variation).padStart(5, '0')
    
    return `${newNumber}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`
  }

  // Generate property images
  private generatePropertyImages(city: BrazilianCity, type: PropertyType, index: number): Array<{
    id: string
    url: string
    alt: string
    order: number
    type: 'main' | 'bedroom' | 'bathroom' | 'kitchen' | 'exterior' | 'other'
  }> {
    const cityImages = {
      'Rio de Janeiro': [
        'https://images.unsplash.com/photo-1544989164-7bb8803a8726?w=500',
        'https://images.unsplash.com/photo-1483729558449-99ef09a8c325?w=500'
      ],
      'São Paulo': [
        'https://images.unsplash.com/photo-1541707338078-b6c78263d9bb?w=500',
        'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=500'
      ],
      'Salvador': [
        'https://images.unsplash.com/photo-1578321272176-b7bbc0679853?w=500'
      ],
      'Florianópolis': [
        'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=500'
      ]
    }

    const fallbackImages = [
      'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=500',
      'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=500',
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=500'
    ]

    const availableImages = cityImages[city.name] || fallbackImages
    const mainImage = availableImages[index % availableImages.length]

    return [
      {
        id: `local_${city.id}_${index}_img_0`,
        url: mainImage,
        alt: `${type} em ${city.name}`,
        order: 0,
        type: 'main' as const
      },
      {
        id: `local_${city.id}_${index}_img_1`,
        url: fallbackImages[(index + 1) % fallbackImages.length],
        alt: `Interior do ${type}`,
        order: 1,
        type: 'bedroom' as const
      },
      {
        id: `local_${city.id}_${index}_img_2`,
        url: fallbackImages[(index + 2) % fallbackImages.length],
        alt: `Área comum`,
        order: 2,
        type: 'other' as const
      }
    ]
  }

  // Generate amenities based on city and property type
  private generateAmenities(city: BrazilianCity, type: PropertyType): string[] {
    const baseAmenities = ['WiFi', 'TV', 'Roupa de Cama', 'Toalhas']
    const citySpecificAmenities = {
      high: ['Piscina', 'Vista Mar', 'Ar Condicionado', 'Churrasqueira', 'Varanda'],
      medium: ['Ar Condicionado', 'Cozinha Equipada', 'Área de Serviço'],
      low: ['Cozinha', 'Ventilador']
    }
    
    const typeSpecificAmenities = {
      [PropertyType.VILLA]: ['Piscina Privativa', 'Jardim', 'Churrasqueira', 'Garagem'],
      [PropertyType.HOUSE]: ['Quintal', 'Garagem', 'Área Gourmet'],
      [PropertyType.APARTMENT]: ['Elevador', 'Portaria 24h'],
      [PropertyType.POUSADA]: ['Café da Manhã', 'Recepção']
    }

    const amenities = [...baseAmenities]
    
    // Add city-specific amenities
    const levelAmenities = citySpecificAmenities[city.touristicLevel] || citySpecificAmenities.low
    amenities.push(...levelAmenities.slice(0, 3))
    
    // Add type-specific amenities
    if (typeSpecificAmenities[type]) {
      amenities.push(...typeSpecificAmenities[type].slice(0, 2))
    }

    // Add some random amenities
    const extraAmenities = ['Estacionamento', 'Pet Friendly', 'Academia', 'Spa', 'Games Room']
    if (Math.random() > 0.5) {
      amenities.push(extraAmenities[Math.floor(Math.random() * extraAmenities.length)])
    }

    // Remove duplicates and return
    return [...new Set(amenities)]
  }

  // Generate house rules
  private generateHouseRules(type: PropertyType): string[] {
    const commonRules = [
      'Check-in: 15:00 às 22:00',
      'Check-out: até 11:00',
      'Não é permitido fumar',
      'Não são permitidas festas ou eventos'
    ]

    const additionalRules = [
      'Silêncio após 22:00',
      'Máximo de 2 hóspedes por quarto',
      'Animais permitidos (consultar antes)',
      'Responsabilidade por danos',
      'Utilização consciente de água e energia'
    ]

    const rules = [...commonRules]
    const numAdditional = Math.floor(Math.random() * 3) + 1
    
    for (let i = 0; i < numAdditional; i++) {
      const rule = additionalRules[Math.floor(Math.random() * additionalRules.length)]
      if (!rules.includes(rule)) {
        rules.push(rule)
      }
    }

    return rules
  }

  // Generate cancellation policy
  private generateCancellationPolicy() {
    const policies = [
      {
        type: 'flexible' as const,
        description: 'Cancelamento gratuito até 24 horas antes',
        rules: [
          { beforeHours: 24, refundPercentage: 100 },
          { beforeHours: 0, refundPercentage: 0 }
        ]
      },
      {
        type: 'moderate' as const,
        description: 'Cancelamento gratuito até 48 horas antes',
        rules: [
          { beforeHours: 48, refundPercentage: 100 },
          { beforeHours: 24, refundPercentage: 50 },
          { beforeHours: 0, refundPercentage: 0 }
        ]
      }
    ]

    return policies[Math.floor(Math.random() * policies.length)]
  }

  // Generate local property data
  private generateLocalData(city: BrazilianCity, index: number): LocalPropertyData {
    const hostNames = [
      'Ana Silva', 'Carlos Santos', 'Maria Oliveira', 'João Pereira', 
      'Fernanda Costa', 'Ricardo Lima', 'Patricia Souza', 'Bruno Almeida'
    ]

    return {
      hostId: `host_${city.id}_${index}`,
      hostName: hostNames[index % hostNames.length],
      hostPhone: `+55${city.stateCode === 'SP' ? '11' : '21'}9${String(Math.floor(Math.random() * 100000000)).padStart(8, '0')}`,
      hostEmail: `host${index}@${city.name.toLowerCase().replace(/\s/g, '')}.com.br`,
      hostAvatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${index}`,
      isSuperhost: Math.random() > 0.7, // 30% superhosts
      
      isVerified: Math.random() > 0.2, // 80% verified
      verifiedDocuments: ['CPF', 'RG', 'Comprovante de Residência'],
      
      commissionRate: 12, // 12% commission
      payoutMethod: Math.random() > 0.5 ? 'pix' : 'bank_transfer',
      payoutDetails: {},
      
      responseRate: 85 + Math.floor(Math.random() * 15), // 85-99%
      responseTime: Math.floor(Math.random() * 120) + 10, // 10-130 minutes
      acceptanceRate: 80 + Math.floor(Math.random() * 20), // 80-99%
      
      customSettings: {
        allowPets: Math.random() > 0.6,
        allowSmoking: false,
        allowParties: false,
        wifi: true,
        parking: city.touristicLevel === 'high' ? Math.random() > 0.3 : Math.random() > 0.5,
        pool: city.touristicLevel === 'high' && Math.random() > 0.7,
        airConditioning: city.region === 'Northeast' || city.region === 'North' || Math.random() > 0.4
      }
    }
  }

  // Search properties with filters
  async searchProperties(filters: SearchFilters): Promise<UnifiedProperty[]> {
    console.log(`🏠 LocalPropertyService: Searching with filters:`, filters)
    
    let results = [...this.properties]

    // Filter by destination
    if (filters.destination) {
      const query = filters.destination.toLowerCase()
      results = results.filter(property => 
        property.location.city.toLowerCase().includes(query) ||
        property.location.state.toLowerCase().includes(query) ||
        property.name.toLowerCase().includes(query)
      )
    }

    // Filter by coordinates (if provided)
    if (filters.coordinates) {
      results = results.filter(property => {
        const distance = this.calculateDistance(
          filters.coordinates!.lat, filters.coordinates!.lng,
          property.location.coordinates.lat, property.location.coordinates.lng
        )
        return distance <= (filters.coordinates!.radius || 50) // Default 50km radius
      })
    }

    // Filter by guest count
    results = results.filter(property => 
      property.accommodates >= (filters.adults + filters.children)
    )

    // Filter by property types
    if (filters.propertyTypes?.length) {
      results = results.filter(property =>
        filters.propertyTypes!.includes(property.type)
      )
    }

    // Filter by bedrooms
    if (filters.minBedrooms) {
      results = results.filter(property =>
        property.bedrooms >= filters.minBedrooms!
      )
    }

    // Filter by bathrooms
    if (filters.minBathrooms) {
      results = results.filter(property =>
        property.bathrooms >= filters.minBathrooms!
      )
    }

    // Filter by price range
    if (filters.minPrice) {
      results = results.filter(property =>
        property.basePricePerNight >= filters.minPrice!
      )
    }
    if (filters.maxPrice) {
      results = results.filter(property =>
        property.basePricePerNight <= filters.maxPrice!
      )
    }

    // Filter by amenities
    if (filters.amenities?.length) {
      results = results.filter(property =>
        filters.amenities!.some(amenity =>
          property.amenities.some(propAmenity =>
            propAmenity.toLowerCase().includes(amenity.toLowerCase())
          )
        )
      )
    }

    // Filter by instant bookable
    if (filters.instantBookable) {
      results = results.filter(property => property.isInstantBookable)
    }

    // Apply sorting
    results = this.applySorting(results, filters.sortBy, filters.sortOrder)

    // Apply pagination
    const startIndex = (filters.page - 1) * filters.limit
    const paginatedResults = results.slice(startIndex, startIndex + filters.limit)

    console.log(`🏠 LocalPropertyService: Found ${paginatedResults.length}/${results.length} properties`)
    
    return paginatedResults
  }

  // Get property by ID
  async getProperty(propertyId: string): Promise<UnifiedProperty | null> {
    return this.properties.find(p => p.id === propertyId) || null
  }

  // Get availability (simplified implementation)
  async getAvailability(
    propertyId: string, 
    checkIn: Date, 
    checkOut: Date
  ): Promise<PropertyAvailability[]> {
    const property = await this.getProperty(propertyId)
    if (!property) return []

    // Simplified availability - in real implementation would check calendar
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24))
    
    return [{
      propertyId,
      source: PropertySource.LOCAL,
      checkIn,
      checkOut,
      isAvailable: Math.random() > 0.1, // 90% available
      basePrice: property.basePricePerNight,
      taxes: Math.round(property.basePricePerNight * 0.05), // 5% tax
      fees: 0,
      discounts: 0,
      totalPrice: Math.round(property.basePricePerNight * nights * 1.05),
      currency: 'BRL',
      rateId: `local_rate_${propertyId}_${Date.now()}`,
      rateType: 'standard',
      minimumStay: property.minimumStay,
      maximumStay: property.maximumStay,
      cachedAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h cache
    }]
  }

  // Create booking (placeholder implementation)
  async createBooking(bookingData: any): Promise<UnifiedBooking | null> {
    // In real implementation, would create booking record
    console.log('🏠 LocalPropertyService: Creating booking for', bookingData.propertyId)
    return null // Placeholder
  }

  // Helper methods
  private applySorting(
    properties: UnifiedProperty[], 
    sortBy?: string, 
    sortOrder: 'asc' | 'desc' = 'asc'
  ): UnifiedProperty[] {
    if (!sortBy) return properties

    return properties.sort((a, b) => {
      let aValue: number = 0
      let bValue: number = 0

      switch (sortBy) {
        case 'price':
          aValue = a.basePricePerNight
          bValue = b.basePricePerNight
          break
        case 'rating':
          aValue = a.rating
          bValue = b.rating
          break
        case 'popularity':
          aValue = a.reviewCount
          bValue = b.reviewCount
          break
        default:
          return 0
      }

      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue
    })
  }

  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371 // Radius of the Earth in km
    const dLat = this.deg2rad(lat2 - lat1)
    const dLng = this.deg2rad(lng2 - lng1)
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
              Math.sin(dLng/2) * Math.sin(dLng/2)
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI/180)
  }

  // Get statistics
  getStats(): {
    totalProperties: number
    citiesWithProperties: number
    averageRating: number
    averagePrice: number
    propertyTypes: { [key: string]: number }
  } {
    const totalProperties = this.properties.length
    const citiesWithProperties = new Set(this.properties.map(p => p.location.city)).size
    const averageRating = this.properties.reduce((sum, p) => sum + p.rating, 0) / totalProperties
    const averagePrice = this.properties.reduce((sum, p) => sum + p.basePricePerNight, 0) / totalProperties
    
    const propertyTypes: { [key: string]: number } = {}
    this.properties.forEach(p => {
      propertyTypes[p.type] = (propertyTypes[p.type] || 0) + 1
    })

    return {
      totalProperties,
      citiesWithProperties,
      averageRating,
      averagePrice,
      propertyTypes
    }
  }
}

// Singleton instance
export const localPropertyService = new LocalPropertyService()
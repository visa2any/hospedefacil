// Featured Properties Service
// Fetches curated properties from the unified API for homepage display

import { UnifiedProperty, SearchFilters, PropertySource } from '../database/schemas'

export interface FeaturedProperty {
  id: string
  title: string
  location: string
  rating: number
  reviews: number
  price: number
  priceFormatted: string
  image: string
  amenities: string[]
  guests: number
  source: PropertySource
  sourceLabel: string
  trustBadge: string
}

class FeaturedPropertiesService {
  private readonly API_BASE = process.env.NODE_ENV === 'development' 
    ? 'http://localhost:3000' 
    : ''

  // Get featured properties for homepage
  async getFeaturedProperties(): Promise<FeaturedProperty[]> {
    try {
      console.log('🏠 Fetching featured properties from unified API...')
      
      // Create search filters for featured properties
      // We'll search for properties in popular Brazilian destinations
      const popularDestinations = [
        'Rio de Janeiro',
        'São Paulo', 
        'Salvador',
        'Búzios',
        'Florianópolis'
      ]

      const allFeaturedProperties: FeaturedProperty[] = []

      // Search for properties in each destination
      for (const destination of popularDestinations) {
        try {
          const searchFilters: SearchFilters = {
            destination,
            checkIn: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
            checkOut: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 3 days later
            adults: 2,
            children: 0,
            infants: 0,
            page: 1,
            limit: 2, // Get 2 properties per destination
            currency: 'BRL',
            includeLocal: true,
            includeLiteApi: true,
            sortBy: 'rating',
            sortOrder: 'desc'
          }

          const response = await fetch(`${this.API_BASE}/api/properties/search`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(searchFilters),
          })

          if (!response.ok) {
            console.error(`❌ Failed to fetch properties for ${destination}:`, response.status)
            continue
          }

          const data = await response.json()
          
          if (data.success && data.data.properties) {
            // Transform properties to featured format
            const featuredProps = data.data.properties
              .slice(0, 1) // Take only 1 property per destination for featured
              .map((property: UnifiedProperty) => this.transformToFeatured(property))

            allFeaturedProperties.push(...featuredProps)
          }
        } catch (error) {
          console.error(`❌ Error fetching properties for ${destination}:`, error)
          continue
        }
      }

      // If we have fewer than 3 featured properties, add some fallback searches
      if (allFeaturedProperties.length < 3) {
        console.log(`⚠️ Only found ${allFeaturedProperties.length} featured properties, adding fallback search...`)
        
        const fallbackFilters: SearchFilters = {
          destination: '',
          checkIn: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          checkOut: new Date(Date.now() + 17 * 24 * 60 * 60 * 1000),
          adults: 2,
          children: 0,
          infants: 0,
          page: 1,
          limit: 6,
          currency: 'BRL',
          includeLocal: true,
          includeLiteApi: true,
          sortBy: 'rating',
          sortOrder: 'desc'
        }

        try {
          const response = await fetch(`${this.API_BASE}/api/properties/search`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(fallbackFilters),
          })

          if (response.ok) {
            const data = await response.json()
            if (data.success && data.data.properties) {
              const additionalProps = data.data.properties
                .slice(0, 6 - allFeaturedProperties.length)
                .map((property: UnifiedProperty) => this.transformToFeatured(property))

              allFeaturedProperties.push(...additionalProps)
            }
          }
        } catch (error) {
          console.error('❌ Error fetching fallback properties:', error)
        }
      }

      // Return up to 3 featured properties, ensuring variety
      const uniqueProperties = this.ensureVariety(allFeaturedProperties)
      console.log(`✅ Fetched ${uniqueProperties.length} featured properties`)
      
      return uniqueProperties.slice(0, 3)

    } catch (error) {
      console.error('❌ Error fetching featured properties:', error)
      
      // Return fallback mock data if API fails
      return this.getFallbackProperties()
    }
  }

  // Transform UnifiedProperty to FeaturedProperty format
  private transformToFeatured(property: UnifiedProperty): FeaturedProperty {
    // Get the main image or fallback to a default
    const mainImage = property.images?.find(img => img.type === 'main')?.url || 
                     property.images?.[0]?.url ||
                     this.getFallbackImage(property.location?.city || '')

    // Format location string
    const location = property.location ? 
      `${property.location.city}, ${property.location.state}` : 
      'Localização não especificada'

    // Get amenities, limit to first 4 most important ones
    const amenities = this.selectBestAmenities(property.amenities || [])

    return {
      id: property.id,
      title: property.name,
      location,
      rating: property.rating || 4.5,
      reviews: property.reviewCount || 0,
      price: property.basePricePerNight || 0,
      priceFormatted: `R$ ${(property.basePricePerNight || 0).toFixed(2)}`,
      image: mainImage,
      amenities,
      guests: property.accommodates || 2,
      source: property.source,
      sourceLabel: property.source === PropertySource.LOCAL ? 'Anfitrião Local' : 'Hotel Verificado',
      trustBadge: property.source === PropertySource.LOCAL ? 'HospedeFácil Verificado' : 'Parceiro Global'
    }
  }

  // Select the most appealing amenities for display
  private selectBestAmenities(amenities: string[]): string[] {
    // Priority order for display
    const priorityAmenities = [
      'WiFi', 'Wifi', 'Wi-Fi',
      'Piscina', 'Pool', 'Swimming Pool',
      'Estacionamento', 'Parking', 'Estacionamento Gratuito',
      'Ar Condicionado', 'Air Conditioning', 'AC',
      'Vista Mar', 'Sea View', 'Ocean View',
      'Academia', 'Gym', 'Fitness Center',
      'Café da Manhã', 'Breakfast', 'Free Breakfast',
      'Pet Friendly', 'Pets Allowed'
    ]

    const selected: string[] = []
    const lowerAmenities = amenities.map(a => a.toLowerCase())

    // First, add priority amenities if available
    for (const priority of priorityAmenities) {
      if (selected.length >= 4) break
      
      const found = amenities.find(amenity => 
        amenity.toLowerCase().includes(priority.toLowerCase())
      )
      
      if (found && !selected.includes(found)) {
        selected.push(found)
      }
    }

    // Fill remaining slots with other amenities
    for (const amenity of amenities) {
      if (selected.length >= 4) break
      if (!selected.includes(amenity)) {
        selected.push(amenity)
      }
    }

    return selected.slice(0, 4)
  }

  // Ensure variety in featured properties (different cities, sources)
  private ensureVariety(properties: FeaturedProperty[]): FeaturedProperty[] {
    const unique: FeaturedProperty[] = []
    const seenCities = new Set<string>()
    const sourceCounts = { [PropertySource.LOCAL]: 0, [PropertySource.LITEAPI]: 0 }

    // First pass: ensure city diversity
    for (const property of properties) {
      const city = property.location.split(',')[0].trim()
      if (!seenCities.has(city) && unique.length < 3) {
        unique.push(property)
        seenCities.add(city)
        sourceCounts[property.source]++
      }
    }

    // Second pass: fill remaining slots with high-rated properties
    for (const property of properties) {
      if (unique.length >= 3) break
      if (!unique.find(p => p.id === property.id)) {
        unique.push(property)
        sourceCounts[property.source]++
      }
    }

    return unique
  }

  // Get fallback image based on city
  private getFallbackImage(city: string): string {
    const cityImages: { [key: string]: string } = {
      'Rio de Janeiro': 'https://images.unsplash.com/photo-1544989164-7bb8803a8726?w=500',
      'São Paulo': 'https://images.unsplash.com/photo-1541707338078-b6c78263d9bb?w=500',
      'Salvador': 'https://images.unsplash.com/photo-1578321272176-b7bbc0679853?w=500',
      'Búzios': 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=500',
      'Florianópolis': 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=500'
    }

    return cityImages[city] || 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=500'
  }

  // Fallback properties if API fails
  private getFallbackProperties(): FeaturedProperty[] {
    return [
      {
        id: 'fallback_1',
        title: 'Cobertura Premium Copacabana',
        location: 'Rio de Janeiro, RJ',
        rating: 4.9,
        reviews: 127,
        price: 450,
        priceFormatted: 'R$ 450.00',
        image: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=500',
        amenities: ['WiFi', 'Estacionamento', 'Piscina', 'Vista Mar'],
        guests: 4,
        source: PropertySource.LOCAL,
        sourceLabel: 'Anfitrião Local',
        trustBadge: 'HospedeFácil Verificado'
      },
      {
        id: 'fallback_2',
        title: 'Loft Moderno Vila Madalena',
        location: 'São Paulo, SP',
        rating: 4.8,
        reviews: 93,
        price: 280,
        priceFormatted: 'R$ 280.00',
        image: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=500',
        amenities: ['WiFi', 'Cozinha', 'Academia', 'Rooftop'],
        guests: 2,
        source: PropertySource.LOCAL,
        sourceLabel: 'Anfitrião Local',
        trustBadge: 'HospedeFácil Verificado'
      },
      {
        id: 'fallback_3',
        title: 'Casa de Praia Morro de São Paulo',
        location: 'Bahia, BA',
        rating: 4.9,
        reviews: 156,
        price: 320,
        priceFormatted: 'R$ 320.00',
        image: 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=500',
        amenities: ['WiFi', 'Ar Condicionado', 'Jardim', 'Próximo à Praia'],
        guests: 6,
        source: PropertySource.LOCAL,
        sourceLabel: 'Anfitrião Local',
        trustBadge: 'HospedeFácil Verificado'
      }
    ]
  }
}

// Singleton instance
export const featuredPropertiesService = new FeaturedPropertiesService()
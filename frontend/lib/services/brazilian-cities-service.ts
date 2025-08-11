// Brazilian Cities Service
// Comprehensive database of Brazilian cities with coverage indicators

export interface BrazilianCity {
  id: string
  name: string
  state: string
  stateCode: string
  region: string
  coordinates: {
    lat: number
    lng: number
  }
  population: number
  touristicLevel: 'high' | 'medium' | 'low'
  hasLocalCoverage: boolean
  hasLiteApiCoverage: boolean
  estimatedProperties: number
  averagePrice: number
  popularityScore: number
}

export interface BrazilianState {
  code: string
  name: string
  region: string
  cities: BrazilianCity[]
}

class BrazilianCitiesService {
  // Comprehensive database of Brazilian cities
  private readonly cities: BrazilianCity[] = [
    // Southeast Region - High Coverage
    {
      id: 'rio_de_janeiro_rj',
      name: 'Rio de Janeiro',
      state: 'Rio de Janeiro',
      stateCode: 'RJ',
      region: 'Southeast',
      coordinates: { lat: -22.9068, lng: -43.1729 },
      population: 6748000,
      touristicLevel: 'high',
      hasLocalCoverage: true,
      hasLiteApiCoverage: true,
      estimatedProperties: 2847,
      averagePrice: 280,
      popularityScore: 95
    },
    {
      id: 'sao_paulo_sp',
      name: 'São Paulo',
      state: 'São Paulo',
      stateCode: 'SP',
      region: 'Southeast',
      coordinates: { lat: -23.5505, lng: -46.6333 },
      population: 12325000,
      touristicLevel: 'high',
      hasLocalCoverage: true,
      hasLiteApiCoverage: true,
      estimatedProperties: 3124,
      averagePrice: 210,
      popularityScore: 88
    },
    {
      id: 'belo_horizonte_mg',
      name: 'Belo Horizonte',
      state: 'Minas Gerais',
      stateCode: 'MG',
      region: 'Southeast',
      coordinates: { lat: -19.9191, lng: -43.9386 },
      population: 2521564,
      touristicLevel: 'medium',
      hasLocalCoverage: true,
      hasLiteApiCoverage: true,
      estimatedProperties: 892,
      averagePrice: 145,
      popularityScore: 72
    },
    {
      id: 'vitoria_es',
      name: 'Vitória',
      state: 'Espírito Santo',
      stateCode: 'ES',
      region: 'Southeast',
      coordinates: { lat: -20.3155, lng: -40.3128 },
      population: 365855,
      touristicLevel: 'medium',
      hasLocalCoverage: true,
      hasLiteApiCoverage: false,
      estimatedProperties: 287,
      averagePrice: 180,
      popularityScore: 65
    },
    // Northeast Region - High Tourism
    {
      id: 'salvador_ba',
      name: 'Salvador',
      state: 'Bahia',
      stateCode: 'BA',
      region: 'Northeast',
      coordinates: { lat: -12.9714, lng: -38.5014 },
      population: 2886698,
      touristicLevel: 'high',
      hasLocalCoverage: true,
      hasLiteApiCoverage: true,
      estimatedProperties: 1456,
      averagePrice: 195,
      popularityScore: 85
    },
    {
      id: 'recife_pe',
      name: 'Recife',
      state: 'Pernambuco',
      stateCode: 'PE',
      region: 'Northeast',
      coordinates: { lat: -8.0476, lng: -34.8770 },
      population: 1653461,
      touristicLevel: 'high',
      hasLocalCoverage: true,
      hasLiteApiCoverage: true,
      estimatedProperties: 987,
      averagePrice: 175,
      popularityScore: 78
    },
    {
      id: 'fortaleza_ce',
      name: 'Fortaleza',
      state: 'Ceará',
      stateCode: 'CE',
      region: 'Northeast',
      coordinates: { lat: -3.7319, lng: -38.5267 },
      population: 2686612,
      touristicLevel: 'high',
      hasLocalCoverage: true,
      hasLiteApiCoverage: true,
      estimatedProperties: 1234,
      averagePrice: 165,
      popularityScore: 82
    },
    {
      id: 'natal_rn',
      name: 'Natal',
      state: 'Rio Grande do Norte',
      stateCode: 'RN',
      region: 'Northeast',
      coordinates: { lat: -5.7945, lng: -35.2110 },
      population: 890480,
      touristicLevel: 'high',
      hasLocalCoverage: true,
      hasLiteApiCoverage: true,
      estimatedProperties: 745,
      averagePrice: 185,
      popularityScore: 75
    },
    {
      id: 'maceio_al',
      name: 'Maceió',
      state: 'Alagoas',
      stateCode: 'AL',
      region: 'Northeast',
      coordinates: { lat: -9.6658, lng: -35.7350 },
      population: 1025360,
      touristicLevel: 'high',
      hasLocalCoverage: true,
      hasLiteApiCoverage: true,
      estimatedProperties: 567,
      averagePrice: 205,
      popularityScore: 80
    },
    // South Region - High Coverage
    {
      id: 'florianopolis_sc',
      name: 'Florianópolis',
      state: 'Santa Catarina',
      stateCode: 'SC',
      region: 'South',
      coordinates: { lat: -27.5954, lng: -48.5480 },
      population: 508826,
      touristicLevel: 'high',
      hasLocalCoverage: true,
      hasLiteApiCoverage: true,
      estimatedProperties: 892,
      averagePrice: 225,
      popularityScore: 88
    },
    {
      id: 'porto_alegre_rs',
      name: 'Porto Alegre',
      state: 'Rio Grande do Sul',
      stateCode: 'RS',
      region: 'South',
      coordinates: { lat: -30.0346, lng: -51.2177 },
      population: 1488252,
      touristicLevel: 'medium',
      hasLocalCoverage: true,
      hasLiteApiCoverage: true,
      estimatedProperties: 654,
      averagePrice: 155,
      popularityScore: 68
    },
    {
      id: 'curitiba_pr',
      name: 'Curitiba',
      state: 'Paraná',
      stateCode: 'PR',
      region: 'South',
      coordinates: { lat: -25.4244, lng: -49.2654 },
      population: 1933105,
      touristicLevel: 'medium',
      hasLocalCoverage: true,
      hasLiteApiCoverage: true,
      estimatedProperties: 543,
      averagePrice: 140,
      popularityScore: 65
    },
    // Center-West Region
    {
      id: 'brasilia_df',
      name: 'Brasília',
      state: 'Distrito Federal',
      stateCode: 'DF',
      region: 'Center-West',
      coordinates: { lat: -15.8267, lng: -47.9218 },
      population: 3094325,
      touristicLevel: 'medium',
      hasLocalCoverage: true,
      hasLiteApiCoverage: true,
      estimatedProperties: 756,
      averagePrice: 165,
      popularityScore: 70
    },
    {
      id: 'campo_grande_ms',
      name: 'Campo Grande',
      state: 'Mato Grosso do Sul',
      stateCode: 'MS',
      region: 'Center-West',
      coordinates: { lat: -20.4697, lng: -54.6201 },
      population: 906092,
      touristicLevel: 'medium',
      hasLocalCoverage: true,
      hasLiteApiCoverage: false,
      estimatedProperties: 234,
      averagePrice: 135,
      popularityScore: 58
    },
    // Tourist Destinations - High Local Coverage
    {
      id: 'buzios_rj',
      name: 'Búzios',
      state: 'Rio de Janeiro',
      stateCode: 'RJ',
      region: 'Southeast',
      coordinates: { lat: -22.7470, lng: -41.8820 },
      population: 33870,
      touristicLevel: 'high',
      hasLocalCoverage: true,
      hasLiteApiCoverage: true,
      estimatedProperties: 456,
      averagePrice: 320,
      popularityScore: 92
    },
    {
      id: 'paraty_rj',
      name: 'Paraty',
      state: 'Rio de Janeiro',
      stateCode: 'RJ',
      region: 'Southeast',
      coordinates: { lat: -23.2173, lng: -44.7131 },
      population: 43207,
      touristicLevel: 'high',
      hasLocalCoverage: true,
      hasLiteApiCoverage: true,
      estimatedProperties: 234,
      averagePrice: 285,
      popularityScore: 87
    },
    {
      id: 'gramado_rs',
      name: 'Gramado',
      state: 'Rio Grande do Sul',
      stateCode: 'RS',
      region: 'South',
      coordinates: { lat: -29.3788, lng: -50.8735 },
      population: 36404,
      touristicLevel: 'high',
      hasLocalCoverage: true,
      hasLiteApiCoverage: true,
      estimatedProperties: 387,
      averagePrice: 195,
      popularityScore: 89
    },
    {
      id: 'canela_rs',
      name: 'Canela',
      state: 'Rio Grande do Sul',
      stateCode: 'RS',
      region: 'South',
      coordinates: { lat: -29.3665, lng: -50.8115 },
      population: 47864,
      touristicLevel: 'high',
      hasLocalCoverage: true,
      hasLiteApiCoverage: true,
      estimatedProperties: 298,
      averagePrice: 185,
      popularityScore: 85
    },
    {
      id: 'morro_sao_paulo_ba',
      name: 'Morro de São Paulo',
      state: 'Bahia',
      stateCode: 'BA',
      region: 'Northeast',
      coordinates: { lat: -13.4291, lng: -38.9161 },
      population: 1200,
      touristicLevel: 'high',
      hasLocalCoverage: true,
      hasLiteApiCoverage: false,
      estimatedProperties: 156,
      averagePrice: 275,
      popularityScore: 91
    },
    {
      id: 'porto_seguro_ba',
      name: 'Porto Seguro',
      state: 'Bahia',
      stateCode: 'BA',
      region: 'Northeast',
      coordinates: { lat: -16.4498, lng: -39.0648 },
      population: 150658,
      touristicLevel: 'high',
      hasLocalCoverage: true,
      hasLiteApiCoverage: true,
      estimatedProperties: 543,
      averagePrice: 210,
      popularityScore: 83
    },
    {
      id: 'jericoacoara_ce',
      name: 'Jericoacoara',
      state: 'Ceará',
      stateCode: 'CE',
      region: 'Northeast',
      coordinates: { lat: -2.7928, lng: -40.5142 },
      population: 18385,
      touristicLevel: 'high',
      hasLocalCoverage: true,
      hasLiteApiCoverage: false,
      estimatedProperties: 234,
      averagePrice: 195,
      popularityScore: 88
    },
    {
      id: 'campos_jordao_sp',
      name: 'Campos do Jordão',
      state: 'São Paulo',
      stateCode: 'SP',
      region: 'Southeast',
      coordinates: { lat: -22.7390, lng: -45.5913 },
      population: 52123,
      touristicLevel: 'high',
      hasLocalCoverage: true,
      hasLiteApiCoverage: true,
      estimatedProperties: 345,
      averagePrice: 235,
      popularityScore: 86
    },
    {
      id: 'ubatuba_sp',
      name: 'Ubatuba',
      state: 'São Paulo',
      stateCode: 'SP',
      region: 'Southeast',
      coordinates: { lat: -23.4340, lng: -45.0839 },
      population: 91824,
      touristicLevel: 'high',
      hasLocalCoverage: true,
      hasLiteApiCoverage: true,
      estimatedProperties: 456,
      averagePrice: 245,
      popularityScore: 82
    },
    // Amazon Region
    {
      id: 'manaus_am',
      name: 'Manaus',
      state: 'Amazonas',
      stateCode: 'AM',
      region: 'North',
      coordinates: { lat: -3.1190, lng: -60.0217 },
      population: 2182763,
      touristicLevel: 'medium',
      hasLocalCoverage: true,
      hasLiteApiCoverage: true,
      estimatedProperties: 345,
      averagePrice: 125,
      popularityScore: 72
    },
    {
      id: 'belem_pa',
      name: 'Belém',
      state: 'Pará',
      stateCode: 'PA',
      region: 'North',
      coordinates: { lat: -1.4554, lng: -48.4898 },
      population: 1499641,
      touristicLevel: 'medium',
      hasLocalCoverage: true,
      hasLiteApiCoverage: false,
      estimatedProperties: 234,
      averagePrice: 115,
      popularityScore: 68
    }
  ]

  // Get city by ID
  getCityById(cityId: string): BrazilianCity | undefined {
    return this.cities.find(city => city.id === cityId)
  }

  // Search cities by name
  searchCities(query: string, limit: number = 10): BrazilianCity[] {
    const normalizedQuery = query.toLowerCase().trim()
    
    if (!normalizedQuery) return this.getPopularCities(limit)

    const results = this.cities.filter(city => 
      city.name.toLowerCase().includes(normalizedQuery) ||
      city.state.toLowerCase().includes(normalizedQuery) ||
      city.stateCode.toLowerCase().includes(normalizedQuery)
    )

    return results
      .sort((a, b) => b.popularityScore - a.popularityScore)
      .slice(0, limit)
  }

  // Get cities by state
  getCitiesByState(stateCode: string): BrazilianCity[] {
    return this.cities
      .filter(city => city.stateCode === stateCode)
      .sort((a, b) => b.popularityScore - a.popularityScore)
  }

  // Get popular tourist destinations
  getPopularCities(limit: number = 10): BrazilianCity[] {
    return this.cities
      .filter(city => city.touristicLevel === 'high')
      .sort((a, b) => b.popularityScore - a.popularityScore)
      .slice(0, limit)
  }

  // Get cities with local coverage
  getCitiesWithLocalCoverage(): BrazilianCity[] {
    return this.cities
      .filter(city => city.hasLocalCoverage)
      .sort((a, b) => b.estimatedProperties - a.estimatedProperties)
  }

  // Get cities with LiteAPI coverage
  getCitiesWithLiteApiCoverage(): BrazilianCity[] {
    return this.cities
      .filter(city => city.hasLiteApiCoverage)
      .sort((a, b) => b.estimatedProperties - a.estimatedProperties)
  }

  // Get cities by region
  getCitiesByRegion(region: string): BrazilianCity[] {
    return this.cities
      .filter(city => city.region === region)
      .sort((a, b) => b.popularityScore - a.popularityScore)
  }

  // Get coverage statistics
  getCoverageStats(): {
    total: number
    withLocal: number
    withLiteApi: number
    withBoth: number
    localOnlyPercent: number
    liteApiOnlyPercent: number
    bothPercent: number
  } {
    const total = this.cities.length
    const withLocal = this.cities.filter(c => c.hasLocalCoverage).length
    const withLiteApi = this.cities.filter(c => c.hasLiteApiCoverage).length
    const withBoth = this.cities.filter(c => c.hasLocalCoverage && c.hasLiteApiCoverage).length

    return {
      total,
      withLocal,
      withLiteApi,
      withBoth,
      localOnlyPercent: Math.round(((withLocal - withBoth) / total) * 100),
      liteApiOnlyPercent: Math.round(((withLiteApi - withBoth) / total) * 100),
      bothPercent: Math.round((withBoth / total) * 100)
    }
  }

  // Get city recommendations based on search preferences
  getRecommendedCities(preferences: {
    region?: string
    touristicLevel?: 'high' | 'medium' | 'low'
    maxPrice?: number
    localCoverageRequired?: boolean
    liteApiCoverageRequired?: boolean
  }): BrazilianCity[] {
    let filtered = [...this.cities]

    if (preferences.region) {
      filtered = filtered.filter(city => city.region === preferences.region)
    }

    if (preferences.touristicLevel) {
      filtered = filtered.filter(city => city.touristicLevel === preferences.touristicLevel)
    }

    if (preferences.maxPrice) {
      filtered = filtered.filter(city => city.averagePrice <= preferences.maxPrice)
    }

    if (preferences.localCoverageRequired) {
      filtered = filtered.filter(city => city.hasLocalCoverage)
    }

    if (preferences.liteApiCoverageRequired) {
      filtered = filtered.filter(city => city.hasLiteApiCoverage)
    }

    return filtered
      .sort((a, b) => b.popularityScore - a.popularityScore)
      .slice(0, 8)
  }

  // Get all Brazilian states
  getStates(): BrazilianState[] {
    const statesMap = new Map<string, BrazilianState>()

    this.cities.forEach(city => {
      if (!statesMap.has(city.stateCode)) {
        statesMap.set(city.stateCode, {
          code: city.stateCode,
          name: city.state,
          region: city.region,
          cities: []
        })
      }
      statesMap.get(city.stateCode)!.cities.push(city)
    })

    return Array.from(statesMap.values())
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  // Check if a city has hybrid coverage (both local and LiteAPI)
  isHybridDestination(cityId: string): boolean {
    const city = this.getCityById(cityId)
    return city ? (city.hasLocalCoverage && city.hasLiteApiCoverage) : false
  }

  // Get nearby cities
  getNearbyCities(coordinates: { lat: number; lng: number }, radiusKm: number = 100): BrazilianCity[] {
    return this.cities.filter(city => {
      const distance = this.calculateDistance(
        coordinates.lat, coordinates.lng,
        city.coordinates.lat, city.coordinates.lng
      )
      return distance <= radiusKm
    }).sort((a, b) => {
      const distA = this.calculateDistance(coordinates.lat, coordinates.lng, a.coordinates.lat, a.coordinates.lng)
      const distB = this.calculateDistance(coordinates.lat, coordinates.lng, b.coordinates.lat, b.coordinates.lng)
      return distA - distB
    })
  }

  // Calculate distance between two coordinates (Haversine formula)
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
}

// Singleton instance
export const brazilianCitiesService = new BrazilianCitiesService()
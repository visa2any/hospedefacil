'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Search, MapPin, Calendar, Users, Star, Heart, Filter, SortDesc, Shield, Clock, Zap, TrendingUp, Eye } from 'lucide-react'
import { Header } from '../../components/layout/header'
import { Footer } from '../../components/layout/footer'
import { Button } from '../../components/ui/button'
import { Card } from '../../components/ui/card'
import Link from 'next/link'
import Image from 'next/image'

// Types for unified property data
interface UnifiedProperty {
  id: string
  title: string
  location: string
  type: string
  price: number
  originalPrice?: number
  discount?: number
  rating: number
  reviews: number
  images: string[]
  amenities: string[]
  guests: number
  bedrooms: number
  bathrooms: number
  verified: boolean
  superhost?: boolean
  instantBooking: boolean
  viewsToday: number
  bookingsToday: number
  lastBooked: string
  source: 'local' | 'liteapi'
  sourceLabel?: string
}

function SearchContent() {
  const searchParams = useSearchParams()
  const [properties, setProperties] = useState<UnifiedProperty[]>([])
  const [loading, setLoading] = useState(false)
  const [sortBy, setSortBy] = useState('relevance')
  const [priceRange, setPriceRange] = useState([0, 2000])
  const [currentViewers, setCurrentViewers] = useState(187)
  const [error, setError] = useState<string | null>(null)
  
  const location = searchParams.get('location') || ''
  const checkin = searchParams.get('checkin') || ''
  const checkout = searchParams.get('checkout') || ''
  const guests = searchParams.get('guests') || '2'

  // Fetch real properties from API
  useEffect(() => {
    const searchProperties = async () => {
      if (!location) return

      setLoading(true)
      setError(null)
      
      try {
        const searchData = {
          destination: location,
          checkIn: checkin ? new Date(checkin).toISOString() : null,
          checkOut: checkout ? new Date(checkout).toISOString() : null,
          adults: parseInt(guests),
          children: 0,
          includeLocal: true,
          includeLiteApi: true
        }

        console.log('🔍 Searching properties:', searchData)

        const response = await fetch('/api/properties/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(searchData)
        })

        if (!response.ok) {
          throw new Error('Failed to fetch properties')
        }

        const data = await response.json()
        
        if (data.success && data.data.properties) {
          // Transform API response to match component interface
          const transformedProperties = data.data.properties.map((prop: any) => ({
            id: prop.id,
            title: prop.name,
            location: `${prop.location.city}, ${prop.location.state}`,
            type: prop.propertyType,
            price: Math.round(prop.basePricePerNight),
            rating: prop.rating || 4.5,
            reviews: prop.reviewCount || Math.floor(Math.random() * 200) + 50,
            images: prop.images?.slice(0, 1) || ['https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800'],
            amenities: prop.amenities?.slice(0, 4) || ['WiFi', 'Cozinha', 'TV', 'Ar Condicionado'],
            guests: prop.capacity.guests,
            bedrooms: prop.capacity.bedrooms,
            bathrooms: prop.capacity.bathrooms,
            verified: true,
            superhost: prop.source === 'local' && Math.random() > 0.7,
            instantBooking: prop.source === 'local' || prop.confirmationType === 'instant',
            viewsToday: Math.floor(Math.random() * 100) + 20,
            bookingsToday: Math.floor(Math.random() * 5),
            lastBooked: ['30 minutos atrás', '1 hora atrás', '2 horas atrás', '4 horas atrás'][Math.floor(Math.random() * 4)],
            source: prop.source,
            sourceLabel: prop.sourceLabel
          }))
          
          setProperties(transformedProperties)
          console.log(`✅ Found ${transformedProperties.length} properties`)
        }
      } catch (error) {
        console.error('❌ Search error:', error)
        setError('Erro ao buscar propriedades. Tente novamente.')
        // Show fallback message instead of empty results
        setProperties([])
      } finally {
        setLoading(false)
      }
    }

    searchProperties()
  }, [location, checkin, checkout, guests])

  // Simulate real-time activity
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentViewers(prev => prev + Math.floor(Math.random() * 5) - 2)
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  const handleSort = (type: string) => {
    setSortBy(type)
    setLoading(true)
    
    setTimeout(() => {
      const sorted = [...properties]
      switch(type) {
        case 'price-low':
          sorted.sort((a, b) => a.price - b.price)
          break
        case 'price-high':
          sorted.sort((a, b) => b.price - a.price)
          break
        case 'rating':
          sorted.sort((a, b) => b.rating - a.rating)
          break
        case 'popular':
          sorted.sort((a, b) => b.viewsToday - a.viewsToday)
          break
        default:
          break
      }
      setProperties(sorted)
      setLoading(false)
    }, 500)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      {/* Search Header */}
      <div className="bg-white border-b sticky top-0 z-40 shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-gray-900">
                {location ? `Hospedagens em ${location}` : 'Todas as Hospedagens'}
              </h1>
              <span className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                {properties.length} propriedades
              </span>
            </div>
            
            {/* Live Activity Indicator */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                <Eye className="w-4 h-4 text-orange-500 animate-pulse" />
                <span className="text-orange-700 font-medium">{currentViewers} pessoas procurando</span>
              </div>
              
              {/* Sort Options */}
              <select
                value={sortBy}
                onChange={(e) => handleSort(e.target.value)}
                className="px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="relevance">Mais Relevantes</option>
                <option value="price-low">Menor Preço</option>
                <option value="price-high">Maior Preço</option>
                <option value="rating">Melhor Avaliação</option>
                <option value="popular">Mais Populares</option>
              </select>
            </div>
          </div>

          {/* Active Filters */}
          {(checkin || checkout || guests !== '2') && (
            <div className="flex flex-wrap gap-2 mt-4">
              {checkin && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm">
                  <Calendar className="w-3 h-3" />
                  Check-in: {new Date(checkin).toLocaleDateString('pt-BR')}
                </span>
              )}
              {checkout && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm">
                  <Calendar className="w-3 h-3" />
                  Check-out: {new Date(checkout).toLocaleDateString('pt-BR')}
                </span>
              )}
              {guests !== '2' && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm">
                  <Users className="w-3 h-3" />
                  {guests} hóspedes
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Filters Sidebar */}
          <div className="lg:col-span-1">
            <Card className="p-6 sticky top-24">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Filter className="w-5 h-5" />
                Filtros
              </h3>

              {/* Price Range */}
              <div className="mb-6">
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Preço por noite
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="number"
                    placeholder="Min"
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    value={priceRange[0]}
                    onChange={(e) => setPriceRange([Number(e.target.value), priceRange[1]])}
                  />
                  <span className="text-gray-500">-</span>
                  <input
                    type="number"
                    placeholder="Max"
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    value={priceRange[1]}
                    onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])}
                  />
                </div>
              </div>

              {/* Property Type */}
              <div className="mb-6">
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Tipo de Propriedade
                </label>
                <div className="space-y-2">
                  {['Casa', 'Apartamento', 'Chalé', 'Villa', 'Pousada'].map((type) => (
                    <label key={type} className="flex items-center gap-2">
                      <input type="checkbox" className="rounded" />
                      <span className="text-sm">{type}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Amenities */}
              <div className="mb-6">
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Comodidades
                </label>
                <div className="space-y-2">
                  {['WiFi', 'Piscina', 'Ar Condicionado', 'Estacionamento', 'Cozinha'].map((amenity) => (
                    <label key={amenity} className="flex items-center gap-2">
                      <input type="checkbox" className="rounded" />
                      <span className="text-sm">{amenity}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Special Offers */}
              <div className="p-4 bg-green-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-green-600" />
                  <span className="font-medium text-green-800">Ofertas Especiais</span>
                </div>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="rounded" />
                  <span className="text-sm">Desconto PIX (3% off)</span>
                </label>
              </div>
            </Card>
          </div>

          {/* Results Grid */}
          <div className="lg:col-span-3">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-64 space-y-4">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <div className="text-center">
                  <p className="text-lg font-medium text-gray-900">Buscando propriedades...</p>
                  <p className="text-sm text-gray-600">Consultando hosts locais e hotéis globais</p>
                </div>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center h-64 space-y-4">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                  <Search className="w-8 h-8 text-gray-400" />
                </div>
                <div className="text-center">
                  <p className="text-lg font-medium text-gray-900">Ops! Algo deu errado</p>
                  <p className="text-sm text-gray-600">{error}</p>
                  <Button className="mt-4" onClick={() => window.location.reload()}>
                    Tentar Novamente
                  </Button>
                </div>
              </div>
            ) : properties.length === 0 && location ? (
              <div className="flex flex-col items-center justify-center h-64 space-y-4">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                  <MapPin className="w-8 h-8 text-gray-400" />
                </div>
                <div className="text-center">
                  <p className="text-lg font-medium text-gray-900">Nenhuma propriedade encontrada</p>
                  <p className="text-sm text-gray-600">Tente buscar por outras cidades ou datas diferentes</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {properties.map((property) => (
                  <motion.div
                    key={property.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Link href={`/property/${property.id}`}>
                      <Card className="overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer group">
                        {/* Image Container */}
                        <div className="relative h-64">
                          <Image
                            src={property.images[0]}
                            alt={property.title}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          
                          {/* Badges */}
                          <div className="absolute top-4 left-4 flex flex-col gap-2">
                            {/* Source Badge */}
                            {property.source === 'liteapi' ? (
                              <span className="bg-blue-500 text-white px-2 py-1 rounded-full text-xs font-medium shadow-md">
                                🏨 Hotel Global
                              </span>
                            ) : (
                              <span className="bg-green-500 text-white px-2 py-1 rounded-full text-xs font-medium shadow-md">
                                🏠 Local Host
                              </span>
                            )}
                            
                            {property.superhost && (
                              <span className="bg-white px-2 py-1 rounded-full text-xs font-medium shadow-md">
                                ⭐ Superhost
                              </span>
                            )}
                            {property.discount && (
                              <span className="bg-red-500 text-white px-2 py-1 rounded-full text-xs font-medium">
                                -{property.discount}%
                              </span>
                            )}
                            {property.instantBooking && (
                              <span className="bg-purple-500 text-white px-2 py-1 rounded-full text-xs font-medium">
                                ⚡ Reserva Imediata
                              </span>
                            )}
                          </div>

                          {/* Heart Icon */}
                          <button className="absolute top-4 right-4 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md hover:scale-110 transition-transform">
                            <Heart className="w-4 h-4" />
                          </button>

                          {/* Live Activity */}
                          {property.viewsToday > 50 && (
                            <div className="absolute bottom-4 left-4 bg-black/70 text-white px-3 py-1 rounded-full text-xs">
                              🔥 {property.viewsToday} visualizações hoje
                            </div>
                          )}
                        </div>

                        {/* Content */}
                        <div className="p-6">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h3 className="font-semibold text-gray-900 line-clamp-1">
                                {property.title}
                              </h3>
                              <div className="flex items-center gap-1 text-sm text-gray-600 mt-1">
                                <MapPin className="w-3 h-3" />
                                {property.location}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Star className="w-4 h-4 text-yellow-500 fill-current" />
                              <span className="font-medium">{property.rating}</span>
                              <span className="text-sm text-gray-500">({property.reviews})</span>
                            </div>
                          </div>

                          {/* Amenities */}
                          <div className="flex items-center gap-3 text-sm text-gray-600 mb-3">
                            <span>{property.guests} hóspedes</span>
                            <span>•</span>
                            <span>{property.bedrooms} quartos</span>
                            <span>•</span>
                            <span>{property.bathrooms} banheiros</span>
                          </div>

                          {/* Price */}
                          <div className="flex items-end justify-between">
                            <div>
                              {property.originalPrice && (
                                <span className="text-sm text-gray-500 line-through">
                                  R$ {property.originalPrice}
                                </span>
                              )}
                              <div className="text-2xl font-bold text-gray-900">
                                R$ {property.price}
                                <span className="text-sm font-normal text-gray-600">/noite</span>
                              </div>
                            </div>
                            
                            {/* Urgency */}
                            {property.bookingsToday > 0 && (
                              <div className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded-full">
                                {property.bookingsToday} reservas hoje
                              </div>
                            )}
                          </div>

                          {/* Last Booked */}
                          {property.lastBooked && (
                            <div className="flex items-center gap-1 text-xs text-gray-500 mt-2">
                              <Clock className="w-3 h-3" />
                              Última reserva {property.lastBooked}
                            </div>
                          )}
                        </div>
                      </Card>
                    </Link>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Load More */}
            <div className="text-center mt-8">
              <Button className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-8 py-3 rounded-xl">
                Carregar Mais Propriedades
              </Button>
            </div>

            {/* Trust Signals */}
            <div className="mt-12 p-6 bg-blue-50 rounded-2xl">
              <div className="flex flex-wrap items-center justify-center gap-8">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-blue-600" />
                  <span className="text-sm font-medium text-blue-800">100% Seguro</span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium text-green-800">PIX com 3% Cashback</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                  <span className="text-sm font-medium text-purple-800">Preços 20% Menores</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <SearchContent />
    </Suspense>
  )
}
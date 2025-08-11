'use client'

import { motion } from 'framer-motion'
import { Star, MapPin, Users, Loader2 } from 'lucide-react'
import { Button } from '../ui/button'
import { Card } from '../ui/card'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { featuredPropertiesService, FeaturedProperty } from '../../lib/services/featured-properties-service'

export function FeaturedProperties() {
  const router = useRouter()
  const [featuredProperties, setFeaturedProperties] = useState<FeaturedProperty[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchFeaturedProperties = async () => {
      try {
        setLoading(true)
        setError(null)
        console.log('🏠 Fetching featured properties...')
        
        const properties = await featuredPropertiesService.getFeaturedProperties()
        console.log(`✅ Loaded ${properties.length} featured properties`)
        
        setFeaturedProperties(properties)
      } catch (err) {
        console.error('❌ Error loading featured properties:', err)
        setError('Erro ao carregar propriedades em destaque')
      } finally {
        setLoading(false)
      }
    }

    fetchFeaturedProperties()
  }, [])

  if (loading) {
    return (
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Propriedades em Destaque
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Descubra lugares incríveis verificados pela nossa equipe
            </p>
          </div>
          
          <div className="flex justify-center items-center min-h-[400px]">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <p className="text-gray-600">Carregando propriedades em destaque...</p>
            </div>
          </div>
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Propriedades em Destaque
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Descubra lugares incríveis verificados pela nossa equipe
            </p>
          </div>
          
          <div className="text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <Button 
              onClick={() => window.location.reload()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Tentar Novamente
            </Button>
          </div>
        </div>
      </section>
    )
  }

  if (featuredProperties.length === 0) {
    return (
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Propriedades em Destaque
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Descubra lugares incríveis verificados pela nossa equipe
            </p>
          </div>
          
          <div className="text-center">
            <p className="text-gray-600 mb-4">Nenhuma propriedade em destaque no momento.</p>
            <Button 
              onClick={() => router.push('/search')}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Ver Todas as Propriedades
            </Button>
          </div>
        </div>
      </section>
    )
  }
  
  return (
    <section className="py-20 bg-gray-50">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Propriedades em Destaque
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Descubra lugares incríveis verificados pela nossa equipe
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {featuredProperties.map((property, index) => (
            <motion.div
              key={property.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-300 group">
                <div className="relative overflow-hidden">
                  <img
                    src={property.image}
                    alt={property.title}
                    className="w-full h-64 object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1">
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-yellow-500 fill-current" />
                      <span className="text-sm font-medium">{property.rating}</span>
                      <span className="text-xs text-gray-500">({property.reviews})</span>
                    </div>
                  </div>
                </div>
                
                <div className="p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    {property.title}
                  </h3>
                  
                  <div className="flex items-center gap-2 text-gray-600 mb-4">
                    <MapPin className="w-4 h-4" />
                    <span className="text-sm">{property.location}</span>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-4">
                    {property.amenities.slice(0, 3).map((amenity) => (
                      <span
                        key={amenity}
                        className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full"
                      >
                        {amenity}
                      </span>
                    ))}
                    {property.amenities.length > 3 && (
                      <span className="text-xs text-gray-500">
                        +{property.amenities.length - 3} mais
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="text-2xl font-bold text-blue-600">
                        {property.priceFormatted}
                      </span>
                      <span className="text-gray-500 text-sm">/noite</span>
                    </div>
                    
                    <div className="flex items-center gap-1 text-gray-500 text-sm">
                      <Users className="w-4 h-4" />
                      <span>{property.guests} hóspedes</span>
                    </div>
                  </div>

                  {/* Trust badge */}
                  <div className="mb-4">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      {property.trustBadge}
                    </span>
                  </div>

                  <Link href={`/property/${property.id}`}>
                    <Button className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold">
                      Ver Detalhes
                    </Button>
                  </Link>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          viewport={{ once: true }}
          className="text-center mt-12"
        >
          <Button 
            variant="outline" 
            size="lg" 
            className="border-2 border-blue-500 text-blue-600 hover:bg-blue-50"
            onClick={() => router.push('/search')}
          >
            Ver Todas as Propriedades
          </Button>
        </motion.div>
      </div>
    </section>
  )
}
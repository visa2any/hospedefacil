'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Search, MapPin, Calendar, Users, Star, Crown, Shield, Heart, Sparkles, Award, Globe, TrendingUp, CheckCircle, Clock, Zap, AlertTriangle, Eye, Flame } from 'lucide-react'
import { Button } from '../ui/button'
import { Card } from '../ui/card'
import { AdvancedCalendar } from '../ui/advanced-calendar'
import { SmartLocationInput } from '../ui/smart-location-input'

// Premium floating particle component - removed to avoid SSR issues
// This component was causing hydration mismatches due to Math.random() usage during SSR

export function Hero() {
  const router = useRouter()
  const [searchExpanded, setSearchExpanded] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [selectedDates, setSelectedDates] = useState({ startDate: null, endDate: null })
  const [guests, setGuests] = useState(2)
  const [showCalendar, setShowCalendar] = useState(false)
  const [currentViewers, setCurrentViewers] = useState(23)
  const [recentBookings, setRecentBookings] = useState(347)
  const [urgencyMessage, setUrgencyMessage] = useState('')

  // Real-time booking simulation - only runs in browser
  useEffect(() => {
    // Prevent running on server-side
    if (typeof window === 'undefined') return

    const interval = setInterval(() => {
      setCurrentViewers(prev => {
        const change = Math.floor(Math.random() * 3) - 1
        const newValue = Math.max(15, Math.min(35, prev + change)) // Keep within reasonable bounds
        return newValue
      })
      
      if (Math.random() < 0.3) { // 30% chance to show recent booking
        const locations = ['Rio de Janeiro', 'São Paulo', 'Florianópolis', 'Salvador', 'Gramado', 'Búzios']
        const randomLocation = locations[Math.floor(Math.random() * locations.length)]
        const minutesAgo = Math.floor(Math.random() * 5) + 1
        setUrgencyMessage(`Alguém acabou de reservar em ${randomLocation} há ${minutesAgo} min`)
        
        setTimeout(() => setUrgencyMessage(''), 4000)
      }
    }, 12000) // Reduced frequency from 8s to 12s

    return () => clearInterval(interval)
  }, [])

  const handleSearch = async () => {
    setIsLoading(true)
    
    // Build search parameters
    const params = new URLSearchParams({
      location: searchValue,
      guests: guests.toString()
    })
    
    if (selectedDates.startDate) {
      params.append('checkin', selectedDates.startDate.toISOString())
    }
    if (selectedDates.endDate) {
      params.append('checkout', selectedDates.endDate.toISOString())
    }
    
    // Navigate to search page
    await new Promise(resolve => setTimeout(resolve, 500)) // Small delay for UX
    router.push(`/search?${params.toString()}`)
  }

  const handleDateSelect = (dateRange) => {
    setSelectedDates(dateRange)
    if (dateRange.startDate && dateRange.endDate) {
      setShowCalendar(false)
    }
  }

  return (
    <section className="relative bg-white overflow-hidden min-h-screen">
      {/* Real-time Activity Notification */}
      {urgencyMessage && (
        <motion.div
          initial={{ opacity: 0, y: -50, x: 100 }}
          animate={{ opacity: 1, y: 0, x: 0 }}
          exit={{ opacity: 0, y: -50, x: 100 }}
          className="fixed top-20 right-6 z-50 bg-gradient-to-r from-green-500 to-green-600 text-white px-4 py-3 rounded-xl shadow-lg max-w-sm"
        >
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            <span className="text-sm font-medium">{urgencyMessage}</span>
          </div>
        </motion.div>
      )}

      {/* Minimal Background Elements */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-gray-50 to-white opacity-50"></div>
        <div className="absolute top-32 right-20 w-80 h-80 bg-blue-100 rounded-full blur-3xl opacity-20"></div>
        <div className="absolute bottom-20 left-20 w-64 h-64 bg-green-100 rounded-full blur-2xl opacity-25"></div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 container mx-auto px-6 pt-24 pb-16">
        {/* Current Activity Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center gap-3 bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-full px-6 py-3">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-orange-600 animate-pulse" />
              <span className="text-orange-800 font-medium">{currentViewers} pessoas visualizando agora</span>
            </div>
            <div className="w-px h-4 bg-orange-300"></div>
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-red-600" />
              <span className="text-red-800 font-medium">{recentBookings} reservas hoje</span>
            </div>
          </div>
        </motion.div>

        {/* Search Form - COMPLETELY REDESIGNED */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-7xl mx-auto mb-16"
        >
          <Card className="bg-white border border-gray-200 shadow-2xl rounded-3xl overflow-hidden">
            <div className="p-12 lg:p-16">
              {/* Header Section */}
              <div className="text-center mb-12">
                {/* Trust Signals Above Search */}
                <div className="flex flex-wrap justify-center gap-4 mb-8">
                  <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-full px-4 py-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-green-800">PIX Instantâneo</span>
                  </div>
                  <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-full px-4 py-2">
                    <Zap className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-800">Confirmação 18s</span>
                  </div>
                  <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-full px-4 py-2">
                    <Shield className="w-4 h-4 text-purple-600" />
                    <span className="text-sm font-medium text-purple-800">100% Seguro</span>
                  </div>
                  <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-full px-4 py-2">
                    <AlertTriangle className="w-4 h-4 text-orange-600" />
                    <span className="text-sm font-medium text-orange-800">Só 10% de comissão</span>
                  </div>
                </div>

                <h1 className="text-6xl md:text-7xl lg:text-8xl xl:text-9xl font-black text-gray-900 mb-6 leading-none">
                  Encontre sua
                  <br />
                  <span className="bg-gradient-to-r from-blue-500 via-green-500 to-purple-500 bg-clip-text text-transparent">
                    hospedagem ideal
                  </span>
                </h1>
                <p className="text-2xl md:text-3xl text-gray-600 mb-4 leading-relaxed max-w-4xl mx-auto">
                  Reserve em segundos. Pague com PIX. Suporte 24/7.
                </p>
              </div>

              {/* Advanced Search Interface */}
              <div className="space-y-8">
                {/* Smart Location Input */}
                <div className="space-y-3">
                  <label className="text-lg font-semibold text-gray-900">
                    Para onde vamos? 🗺️
                  </label>
                  <SmartLocationInput
                    value={searchValue}
                    onChange={setSearchValue}
                    placeholder="Digite uma cidade, praia ou região... Ex: Rio de Janeiro, Gramado, Fernando de Noronha"
                    className="w-full"
                  />
                </div>

                {/* Dates and Guests Row */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Date Selection */}
                  <div className="lg:col-span-2 space-y-3">
                    <label className="text-lg font-semibold text-gray-900">
                      Quando? 📅
                    </label>
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <div className="relative">
                          <Calendar className="absolute left-5 top-5 w-6 h-6 text-gray-400" />
                          <button
                            onClick={() => setShowCalendar(true)}
                            className="w-full pl-14 pr-5 py-5 border-2 border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent text-lg text-left hover:border-blue-300 transition-colors"
                          >
                            {selectedDates.startDate 
                              ? selectedDates.startDate.toLocaleDateString('pt-BR')
                              : 'Check-in'
                            }
                          </button>
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="relative">
                          <Calendar className="absolute left-5 top-5 w-6 h-6 text-gray-400" />
                          <button
                            onClick={() => setShowCalendar(true)}
                            className="w-full pl-14 pr-5 py-5 border-2 border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent text-lg text-left hover:border-blue-300 transition-colors"
                          >
                            {selectedDates.endDate 
                              ? selectedDates.endDate.toLocaleDateString('pt-BR')
                              : 'Check-out'
                            }
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Guests Selection */}
                  <div className="space-y-3">
                    <label className="text-lg font-semibold text-gray-900">
                      Hóspedes 👥
                    </label>
                    <div className="relative">
                      <Users className="absolute left-5 top-5 w-6 h-6 text-gray-400" />
                      <select 
                        value={guests}
                        onChange={(e) => setGuests(Number(e.target.value))}
                        className="w-full pl-14 pr-5 py-5 border-2 border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent appearance-none text-lg"
                      >
                        <option value="1">1 hóspede</option>
                        <option value="2">2 hóspedes</option>
                        <option value="3">3 hóspedes</option>
                        <option value="4">4 hóspedes</option>
                        <option value="5">5+ hóspedes</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Search Buttons - OPTIMIZED FOR CONVERSION */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mt-10">
                  <motion.div className="lg:col-span-3" whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                    <Button
                      onClick={handleSearch}
                      disabled={isLoading || !searchValue}
                      className="w-full h-16 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold text-xl rounded-2xl transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50"
                    >
                      {isLoading ? (
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Buscando hospedagens...
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <Search className="w-7 h-7" />
                          <span>Ver Hospedagens Disponíveis</span>
                          {searchValue && (
                            <span className="text-orange-200">em {searchValue}</span>
                          )}
                        </div>
                      )}
                    </Button>
                  </motion.div>

                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button
                      variant="outline"
                      onClick={() => window.open(`https://wa.me/5511999999999?text=Olá! Preciso de ajuda para encontrar uma hospedagem.`, '_blank')}
                      className="w-full h-16 px-4 border-2 border-green-300 text-green-600 hover:bg-green-50 font-semibold text-base rounded-2xl transition-all duration-300"
                    >
                      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 2.079.549 4.112 1.595 5.936L0 24l6.256-1.612c1.741.943 3.706 1.444 5.761 1.444 6.621 0 11.988-5.367 11.988-11.988C23.988 5.384 18.638.017 12.017 0zm5.985 17.138c-.246.688-1.456 1.272-2.021 1.338-.564.065-1.299.146-3.767-.781-2.638-1.051-4.344-3.772-4.475-3.952-.131-.181-.889-1.18-.889-2.25 0-1.07.557-1.596.754-1.815.197-.218.43-.273.574-.273.144 0 .287.001.411.008.132.006.308-.051.481.367.197.479.674 1.634.732 1.753.058.118.097.256.02.414-.078.157-.117.256-.234.393-.118.137-.247.306-.354.411-.118.117-.24.243-.103.477.137.234.608 1.004 1.305 1.625.895.798 1.648 1.044 1.882 1.161.234.118.37.099.506-.059.137-.157.589-.688.746-.925.157-.234.315-.196.53-.118.216.079 1.366.644 1.601.762.234.118.39.177.448.275.059.099.059.573-.187 1.261z"/>
                      </svg>
                      Ajuda
                    </Button>
                  </motion.div>
                </div>

                {/* Social Proof Section - ENHANCED */}
                <div className="mt-12">
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-8">
                    <div className="flex flex-wrap justify-center items-center gap-8 lg:gap-12">
                      <div className="flex items-center gap-3">
                        <div className="flex -space-x-2">
                          <div className="w-10 h-10 rounded-full bg-blue-500 border-3 border-white shadow-lg"></div>
                          <div className="w-10 h-10 rounded-full bg-green-500 border-3 border-white shadow-lg"></div>
                          <div className="w-10 h-10 rounded-full bg-purple-500 border-3 border-white shadow-lg"></div>
                          <div className="w-10 h-10 rounded-full bg-yellow-500 border-3 border-white shadow-lg"></div>
                        </div>
                        <div className="text-left">
                          <div className="text-2xl font-bold text-gray-900">{recentBookings}.847</div>
                          <div className="text-sm text-gray-600">reservas esta semana</div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="flex text-yellow-400">
                          {[...Array(5)].map((_, i) => (
                            <Star key={i} className="w-6 h-6 fill-current" />
                          ))}
                        </div>
                        <div className="text-left">
                          <div className="text-2xl font-bold text-gray-900">4.95</div>
                          <div className="text-sm text-gray-600">127k avaliações</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
                          <CheckCircle className="w-6 h-6 text-white" />
                        </div>
                        <div className="text-left">
                          <div className="text-2xl font-bold text-gray-900">100%</div>
                          <div className="text-sm text-gray-600">verificado e seguro</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Advanced Calendar Modal */}
        {showCalendar && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowCalendar(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-4xl"
            >
              <AdvancedCalendar
                onDateSelect={handleDateSelect}
                className="w-full"
              />
            </motion.div>
          </motion.div>
        )}

        {/* Bottom Trust Indicators - EXPANDED */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="text-center"
        >
          <div className="bg-gray-50 rounded-3xl p-8 max-w-6xl mx-auto">
            <p className="text-lg text-gray-600 mb-8 font-medium">Mais de 847 mil brasileiros confiam no HospedeFácil</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="flex items-center justify-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <Clock className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <div className="text-lg font-bold text-gray-900">18 segundos</div>
                  <div className="text-sm text-gray-600">confirmação média</div>
                </div>
              </div>
              
              <div className="flex items-center justify-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <div className="text-lg font-bold text-gray-900">100% seguro</div>
                  <div className="text-sm text-gray-600">pagamento garantido</div>
                </div>
              </div>
              
              <div className="flex items-center justify-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <Heart className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <div className="text-lg font-bold text-gray-900">Flexível</div>
                  <div className="text-sm text-gray-600">cancelamento grátis</div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, Search, Star, TrendingUp, Clock, Users, Zap } from 'lucide-react'
import { brazilianCitiesService, BrazilianCity } from '../../lib/services/brazilian-cities-service'

interface LocationSuggestion extends BrazilianCity {
  recentSearches?: number
  trending?: boolean
  description?: string
  tier: 1 | 2 | 3 | 4
  recommendedFor: string[]
  type: 'city' | 'region' | 'beach' | 'mountain' | 'historic'
  coverage: {
    local: number
    liteapi: number
    total: number
    confidence: 'high' | 'medium' | 'low'
  }
}

interface SmartLocationInputProps {
  value: string
  onChange: (value: string) => void
  onLocationSelect?: (location: LocationSuggestion) => void
  placeholder?: string
  className?: string
}

// Convert BrazilianCity to LocationSuggestion format
const convertToLocationSuggestion = (city: BrazilianCity): LocationSuggestion => {
  // Determine city type based on tourism level and region
  let type: LocationSuggestion['type'] = 'city'
  if (city.name.includes('Praia') || city.name === 'Búzios' || city.name === 'Morro de São Paulo') {
    type = 'beach'
  } else if (city.name === 'Gramado' || city.name === 'Campos do Jordão') {
    type = 'mountain'  
  } else if (city.name === 'Paraty' || city.name.includes('Ouro')) {
    type = 'historic'
  }

  // Determine tier based on population and coverage
  let tier: 1 | 2 | 3 | 4 = 4
  if (city.population > 2000000 && city.hasLiteApiCoverage) {
    tier = 1
  } else if (city.population > 500000 || (city.touristicLevel === 'high' && city.hasLiteApiCoverage)) {
    tier = 2
  } else if (city.touristicLevel === 'high' || city.estimatedProperties > 500) {
    tier = 3
  }

  // Calculate coverage confidence
  let confidence: 'high' | 'medium' | 'low' = 'low'
  if (city.hasLocalCoverage && city.hasLiteApiCoverage && city.estimatedProperties > 1000) {
    confidence = 'high'
  } else if ((city.hasLocalCoverage || city.hasLiteApiCoverage) && city.estimatedProperties > 200) {
    confidence = 'medium'
  }

  // Generate recommended activities based on city characteristics
  const recommendedFor: string[] = []
  if (city.touristicLevel === 'high') recommendedFor.push('turismo')
  if (city.population > 1000000) recommendedFor.push('negócios')
  if (type === 'beach') recommendedFor.push('praia', 'relaxamento')
  if (type === 'mountain') recommendedFor.push('natureza', 'friozinho')
  if (type === 'historic') recommendedFor.push('história', 'cultura')
  if (city.region === 'Northeast') recommendedFor.push('cultura')

  return {
    ...city,
    type,
    tier,
    trending: city.touristicLevel === 'high' && city.popularityScore > 85,
    recentSearches: Math.floor(city.popularityScore * 50) + Math.floor(Math.random() * 100),
    description: generateCityDescription(city),
    recommendedFor,
    coverage: {
      local: Math.floor(city.estimatedProperties * (city.hasLocalCoverage ? 0.6 : 0)),
      liteapi: Math.floor(city.estimatedProperties * (city.hasLiteApiCoverage ? 0.4 : 0)),
      total: city.estimatedProperties,
      confidence
    }
  }
}

// Generate city descriptions based on characteristics
const generateCityDescription = (city: BrazilianCity): string => {
  const descriptions: { [key: string]: string } = {
    'Rio de Janeiro': 'Cidade maravilhosa com praias famosas e grande variedade',
    'São Paulo': 'Capital financeira com hotéis de luxo e acomodações locais',
    'Salvador': 'Capital da Bahia com mix de pousadas locais e hotéis',
    'Brasília': 'Capital federal com foco em negócios e hotéis executivos',
    'Florianópolis': 'Ilha da magia com forte presença de hosts locais',
    'Gramado': 'Charme europeu com pousadas locais e alguns hotéis',
    'Búzios': 'Destino sofisticado com pousadas charmosas',
    'Campos do Jordão': 'Suíça brasileira com pousadas locais predominantes',
    'Paraty': 'Cidade colonial com pousadas históricas',
    'Jericoacoara': 'Vila de pescadores com acomodações autênticas'
  }

  if (descriptions[city.name]) {
    return descriptions[city.name]
  }

  // Generate dynamic description
  let description = city.touristicLevel === 'high' ? 'Destino turístico popular' : 'Cidade'
  
  if (city.hasLocalCoverage && city.hasLiteApiCoverage) {
    description += ' com variedade de hotéis e hospedagens locais'
  } else if (city.hasLocalCoverage) {
    description += ' com hospedagens locais autênticas'
  } else if (city.hasLiteApiCoverage) {
    description += ' com hotéis e resorts'
  }

  return description
}

const getTypeIcon = (type: LocationSuggestion['type']) => {
  switch (type) {
    case 'beach': return '🏖️'
    case 'mountain': return '⛰️'
    case 'historic': return '🏛️'
    case 'city': return '🌆'
    case 'region': return '🗺️'
    default: return '📍'
  }
}

const getTypeLabel = (type: LocationSuggestion['type']) => {
  switch (type) {
    case 'beach': return 'Praia'
    case 'mountain': return 'Montanha'
    case 'historic': return 'Histórica'
    case 'city': return 'Cidade'
    case 'region': return 'Região'
    default: return 'Destino'
  }
}

export function SmartLocationInput({
  value,
  onChange,
  onLocationSelect,
  placeholder = "Para onde você quer viajar?",
  className = ""
}: SmartLocationInputProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([])
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!value || value.length < 2) {
      // Show popular destinations when no search
      const popularCities = brazilianCitiesService.getPopularCities(8)
      const trendingSuggestions = popularCities.map(convertToLocationSuggestion)
      setSuggestions(trendingSuggestions)
      return
    }

    // Search cities based on user input
    const matchingCities = brazilianCitiesService.searchCities(value, 10)
    const filtered = matchingCities.map(convertToLocationSuggestion)
    
    setSuggestions(filtered)
  }, [value])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    onChange(newValue)
    setIsOpen(true)
    setHighlightedIndex(-1)
  }

  const handleSuggestionClick = (suggestion: LocationSuggestion) => {
    onChange(suggestion.name)
    onLocationSelect?.(suggestion)
    setIsOpen(false)
    setHighlightedIndex(-1)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex(prev => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        )
        break
      case 'Enter':
        e.preventDefault()
        if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
          handleSuggestionClick(suggestions[highlightedIndex])
        }
        break
      case 'Escape':
        setIsOpen(false)
        setHighlightedIndex(-1)
        break
    }
  }

  const handleFocus = () => {
    setIsOpen(true)
  }

  const handleBlur = (e: React.FocusEvent) => {
    // Delay closing to allow for clicks on suggestions
    setTimeout(() => {
      if (!suggestionsRef.current?.contains(document.activeElement)) {
        setIsOpen(false)
        setHighlightedIndex(-1)
      }
    }, 150)
  }

  const highlightMatch = (text: string, query: string) => {
    if (!query) return text
    
    const index = text.toLowerCase().indexOf(query.toLowerCase())
    if (index === -1) return text
    
    return (
      <>
        {text.slice(0, index)}
        <strong className="font-semibold text-blue-600">
          {text.slice(index, index + query.length)}
        </strong>
        {text.slice(index + query.length)}
      </>
    )
  }

  return (
    <div className={`relative ${className}`}>
      {/* Input Field */}
      <div className="relative">
        <div className="absolute left-5 top-1/2 transform -translate-y-1/2 z-10">
          <MapPin className="w-6 h-6 text-gray-400" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          className="w-full pl-14 pr-5 py-5 border-2 border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent text-lg bg-white shadow-sm hover:border-gray-300 transition-all duration-300"
        />
        
        {/* Loading/Search indicator */}
        {isOpen && suggestions.length > 0 && (
          <div className="absolute right-5 top-1/2 transform -translate-y-1/2">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Search className="w-4 h-4" />
              <span>{suggestions.length} opções</span>
            </div>
          </div>
        )}
      </div>

      {/* Suggestions Dropdown */}
      <AnimatePresence>
        {isOpen && suggestions.length > 0 && (
          <motion.div
            ref={suggestionsRef}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden z-50 max-h-96"
          >
            {/* Header */}
            {!value && (
              <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 border-b border-gray-100">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                  <span>Destinos populares</span>
                </div>
              </div>
            )}

            {/* Suggestions List */}
            <div className="max-h-80 overflow-y-auto">
              {suggestions.map((suggestion, index) => (
                <motion.div
                  key={suggestion.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.03 }}
                  className={`
                    p-4 cursor-pointer transition-all duration-200 border-b border-gray-50 last:border-b-0
                    ${index === highlightedIndex 
                      ? 'bg-blue-50 border-l-4 border-l-blue-500' 
                      : 'hover:bg-gray-50'
                    }
                  `}
                  onClick={() => handleSuggestionClick(suggestion)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      {/* Location Icon & Coverage Badge */}
                      <div className="flex flex-col items-center gap-1">
                        <div className="text-2xl flex-shrink-0">
                          {getTypeIcon(suggestion.type)}
                        </div>
                        {/* Coverage Indicator */}
                        <div className="flex gap-1">
                          {suggestion.coverage.local > 0 && (
                            <div className="w-2 h-2 bg-green-500 rounded-full" title="Hosts Locais"></div>
                          )}
                          {suggestion.coverage.liteapi > 0 && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full" title="Hotéis Globais"></div>
                          )}
                        </div>
                      </div>
                      
                      {/* Location Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-900 text-lg truncate">
                            {highlightMatch(suggestion.name, value)}
                          </span>
                          <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                            {suggestion.state}
                          </span>
                          {suggestion.trending && (
                            <div className="flex items-center gap-1 text-xs text-orange-600 bg-orange-100 px-2 py-1 rounded-full">
                              <TrendingUp className="w-3 h-3" />
                              <span>Trending</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-gray-600 mb-1">
                          <span className="flex items-center gap-1">
                            <span className="font-medium text-green-600">
                              R$ {suggestion.averagePrice}
                            </span>
                            <span>/noite</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {suggestion.estimatedProperties.toLocaleString()} opções
                          </span>
                        </div>
                        
                        {/* Hybrid Coverage Details */}
                        <div className="flex items-center gap-3 text-xs">
                          {suggestion.coverage.local > 0 && (
                            <span className="flex items-center gap-1 text-green-700 bg-green-50 px-2 py-1 rounded-full">
                              🏠 {suggestion.coverage.local.toLocaleString()} locais
                            </span>
                          )}
                          {suggestion.coverage.liteapi > 0 && (
                            <span className="flex items-center gap-1 text-blue-700 bg-blue-50 px-2 py-1 rounded-full">
                              🏨 {suggestion.coverage.liteapi.toLocaleString()} hotéis
                            </span>
                          )}
                          {suggestion.tier === 1 && (
                            <span className="flex items-center gap-1 text-purple-700 bg-purple-50 px-2 py-1 rounded-full">
                              ⭐ Cobertura total
                            </span>
                          )}
                        </div>
                        
                        {suggestion.description && (
                          <p className="text-sm text-gray-500 mt-1 truncate">
                            {suggestion.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Popularity Score */}
                    <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-500 fill-current" />
                        <span className="text-sm font-medium text-gray-700">
                          {(suggestion.popularityScore / 10).toFixed(1)}
                        </span>
                      </div>
                      <Zap className="w-4 h-4 text-blue-500" />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-100">
              <div className="text-xs text-gray-500 text-center">
                💡 Dica: Use palavras-chave como "praia", "montanha" ou "histórica"
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* No Results */}
      {isOpen && value.length >= 2 && suggestions.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-gray-200 p-6 text-center z-50"
        >
          <div className="text-gray-500 mb-2">
            <Search className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p className="font-medium">Nenhum destino encontrado</p>
            <p className="text-sm">Tente buscar por cidade, estado ou região</p>
          </div>
          
          <div className="mt-4 p-4 bg-blue-50 rounded-xl">
            <p className="text-sm text-blue-700">
              <strong>Sugestão:</strong> Experimente buscar por "Rio de Janeiro", "Gramado" ou "Fernando de Noronha"
            </p>
          </div>
        </motion.div>
      )}
    </div>
  )
}
'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { 
  Star, MapPin, Users, Bed, Bath, Wifi, Car, Waves, Wind, 
  ChefHat, Tv, Heart, Share2, Shield, Clock, CheckCircle,
  Calendar, ChevronLeft, ChevronRight, X, MessageCircle,
  Award, Zap, AlertTriangle, Eye, TrendingUp
} from 'lucide-react'
import { Header } from '../../../components/layout/header'
import { Footer } from '../../../components/layout/footer'
import { Button } from '../../../components/ui/button'
import { Card } from '../../../components/ui/card'
import { AdvancedCalendar } from '../../../components/ui/advanced-calendar'
import Link from 'next/link'

// Mock property data
const propertyData = {
  id: '1',
  title: 'Cobertura Vista Mar em Copacabana',
  type: 'Cobertura',
  location: 'Copacabana, Rio de Janeiro - RJ',
  coordinates: { lat: -22.9711, lng: -43.1823 },
  price: 450,
  originalPrice: 580,
  discount: 22,
  cleaningFee: 0,
  serviceFee: 0,
  rating: 4.95,
  reviews: 234,
  description: `
    Desfrute de uma estadia inesquecível nesta cobertura deslumbrante em Copacabana, 
    com vista panorâmica para o mar e toda a orla. Localizada a apenas 2 minutos a pé 
    da praia, esta propriedade oferece o melhor do Rio de Janeiro.
    
    O espaço foi recentemente renovado com acabamentos de alto padrão e decoração moderna. 
    A varanda espaçosa é perfeita para admirar o pôr do sol enquanto desfruta de um drink. 
    
    Ideal para casais, famílias ou grupos de amigos que buscam conforto e localização privilegiada.
  `,
  images: [
    'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1200',
    'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=1200',
    'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=1200',
    'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200',
    'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=1200'
  ],
  host: {
    name: 'Carlos Silva',
    image: 'https://i.pravatar.cc/150?img=7',
    superhost: true,
    verified: true,
    responseRate: 98,
    responseTime: '1 hora',
    joinedDate: 'Janeiro 2020',
    languages: ['Português', 'Inglês', 'Espanhol'],
    about: 'Anfitrião experiente, apaixonado por proporcionar experiências únicas no Rio.'
  },
  amenities: [
    { icon: Wifi, name: 'WiFi 500mb' },
    { icon: Waves, name: 'Piscina' },
    { icon: Wind, name: 'Ar Condicionado' },
    { icon: ChefHat, name: 'Cozinha Completa' },
    { icon: Car, name: 'Estacionamento' },
    { icon: Tv, name: 'Smart TV 55"' }
  ],
  guests: 4,
  bedrooms: 2,
  beds: 3,
  bathrooms: 2,
  checkIn: '14:00',
  checkOut: '11:00',
  houseRules: [
    'Não é permitido fumar',
    'Sem festas ou eventos',
    'Animais de estimação permitidos',
    'Check-in autônomo com cofre de chaves'
  ],
  cancellationPolicy: 'Cancelamento gratuito até 48h antes do check-in',
  instantBooking: true,
  viewsToday: 127,
  bookingsToday: 3,
  lastBooked: '2 horas atrás',
  occupancyRate: 87,
  nextAvailable: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
}

// Mock reviews
const reviews = [
  {
    id: '1',
    user: 'Ana Paula',
    avatar: 'https://i.pravatar.cc/150?img=1',
    rating: 5,
    date: 'Novembro 2024',
    comment: 'Apartamento incrível! A vista é de tirar o fôlego. Carlos foi super atencioso.'
  },
  {
    id: '2',
    user: 'João Pedro',
    avatar: 'https://i.pravatar.cc/150?img=3',
    rating: 5,
    date: 'Outubro 2024',
    comment: 'Localização perfeita, apartamento limpo e bem equipado. Recomendo!'
  },
  {
    id: '3',
    user: 'Maria Fernanda',
    avatar: 'https://i.pravatar.cc/150?img=5',
    rating: 4,
    date: 'Setembro 2024',
    comment: 'Ótima estadia! Só o elevador que estava em manutenção, mas nada que atrapalhasse.'
  }
]

export default function PropertyPage() {
  const params = useParams()
  const router = useRouter()
  const [selectedImage, setSelectedImage] = useState(0)
  const [showAllPhotos, setShowAllPhotos] = useState(false)
  const [showCalendar, setShowCalendar] = useState(false)
  const [selectedDates, setSelectedDates] = useState({ startDate: null, endDate: null })
  const [guests, setGuests] = useState(2)
  const [currentViewers, setCurrentViewers] = useState(23)

  const property = propertyData // In production, fetch based on params.id

  const calculateTotal = () => {
    if (!selectedDates.startDate || !selectedDates.endDate) return 0
    const days = Math.ceil((selectedDates.endDate.getTime() - selectedDates.startDate.getTime()) / (1000 * 60 * 60 * 24))
    return days * property.price
  }

  const handleReserve = () => {
    const params = new URLSearchParams({
      propertyId: property.id,
      checkin: selectedDates.startDate?.toISOString() || '',
      checkout: selectedDates.endDate?.toISOString() || '',
      guests: guests.toString(),
      total: calculateTotal().toString()
    })
    router.push(`/checkout?${params}`)
  }

  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Live Activity Banner */}
      <div className="bg-gradient-to-r from-orange-50 to-red-50 border-b border-orange-200">
        <div className="container mx-auto px-6 py-3">
          <div className="flex items-center justify-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-orange-600 animate-pulse" />
              <span className="text-orange-800 font-medium">{currentViewers} pessoas vendo agora</span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-red-600" />
              <span className="text-red-800 font-medium">Alta demanda - {property.bookingsToday} reservas hoje</span>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        {/* Title Section */}
        <div className="mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{property.title}</h1>
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-yellow-500 fill-current" />
                  <span className="font-medium">{property.rating}</span>
                  <span className="text-gray-500">({property.reviews} avaliações)</span>
                </div>
                {property.host.superhost && (
                  <span className="flex items-center gap-1">
                    <Award className="w-4 h-4 text-purple-600" />
                    <span className="text-purple-600 font-medium">Superhost</span>
                  </span>
                )}
                <div className="flex items-center gap-1 text-gray-600">
                  <MapPin className="w-4 h-4" />
                  <span>{property.location}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="p-2">
                <Share2 className="w-5 h-5" />
              </Button>
              <Button variant="outline" className="p-2">
                <Heart className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Image Gallery */}
        <div className="mb-8">
          <div className="grid grid-cols-4 gap-2 rounded-2xl overflow-hidden h-[500px]">
            <div className="col-span-2 row-span-2">
              <Image
                src={property.images[0]}
                alt={property.title}
                width={800}
                height={600}
                className="w-full h-full object-cover cursor-pointer hover:opacity-95 transition-opacity"
                onClick={() => setShowAllPhotos(true)}
              />
            </div>
            {property.images.slice(1, 5).map((image, index) => (
              <div key={index} className="relative">
                <Image
                  src={image}
                  alt={`${property.title} ${index + 2}`}
                  width={400}
                  height={300}
                  className="w-full h-full object-cover cursor-pointer hover:opacity-95 transition-opacity"
                  onClick={() => setShowAllPhotos(true)}
                />
                {index === 3 && (
                  <button
                    onClick={() => setShowAllPhotos(true)}
                    className="absolute inset-0 bg-black/50 text-white flex items-center justify-center hover:bg-black/60 transition-colors"
                  >
                    <span className="font-medium">Ver todas as fotos</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Property Info */}
            <div className="pb-8 border-b">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    {property.type} hospedado por {property.host.name}
                  </h2>
                  <div className="flex items-center gap-4 mt-2 text-gray-600">
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {property.guests} hóspedes
                    </span>
                    <span className="flex items-center gap-1">
                      <Bed className="w-4 h-4" />
                      {property.bedrooms} quartos
                    </span>
                    <span className="flex items-center gap-1">
                      <Bath className="w-4 h-4" />
                      {property.bathrooms} banheiros
                    </span>
                  </div>
                </div>
                <div className="w-16 h-16 relative">
                  <Image
                    src={property.host.image}
                    alt={property.host.name}
                    fill
                    className="rounded-full object-cover"
                  />
                  {property.host.superhost && (
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center">
                      <Award className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Special Features */}
            <div className="py-8 border-b">
              <div className="space-y-4">
                {property.instantBooking && (
                  <div className="flex gap-4">
                    <Zap className="w-6 h-6 text-green-600 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold text-gray-900">Reserva Imediata</h3>
                      <p className="text-sm text-gray-600">Reserve agora sem esperar aprovação do anfitrião</p>
                    </div>
                  </div>
                )}
                <div className="flex gap-4">
                  <Shield className="w-6 h-6 text-blue-600 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-gray-900">100% Seguro</h3>
                    <p className="text-sm text-gray-600">Propriedade verificada e anfitrião confiável</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <Clock className="w-6 h-6 text-purple-600 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-gray-900">Check-in Flexível</h3>
                    <p className="text-sm text-gray-600">Check-in autônomo com cofre de chaves</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="py-8 border-b">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Sobre o espaço</h3>
              <p className="text-gray-600 whitespace-pre-line">{property.description}</p>
            </div>

            {/* Amenities */}
            <div className="py-8 border-b">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Comodidades</h3>
              <div className="grid grid-cols-2 gap-4">
                {property.amenities.map((amenity, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <amenity.icon className="w-5 h-5 text-gray-600" />
                    <span className="text-gray-700">{amenity.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Calendar */}
            <div className="py-8 border-b">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Disponibilidade</h3>
              <AdvancedCalendar
                onDateSelect={(dates) => setSelectedDates(dates)}
                className="w-full"
              />
            </div>

            {/* Reviews */}
            <div className="py-8">
              <h3 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-500 fill-current" />
                {property.rating} · {property.reviews} avaliações
              </h3>
              <div className="space-y-6">
                {reviews.map((review) => (
                  <div key={review.id} className="flex gap-4">
                    <Image
                      src={review.avatar}
                      alt={review.user}
                      width={48}
                      height={48}
                      className="rounded-full"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">{review.user}</span>
                        <span className="text-sm text-gray-500">{review.date}</span>
                      </div>
                      <div className="flex items-center gap-1 mb-2">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-4 h-4 ${
                              i < review.rating
                                ? 'text-yellow-500 fill-current'
                                : 'text-gray-300'
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-gray-600">{review.comment}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="outline" className="mt-6">
                Ver todas as {property.reviews} avaliações
              </Button>
            </div>
          </div>

          {/* Booking Card */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24 p-6 shadow-xl border-2">
              {/* Price Header */}
              <div className="mb-6">
                {property.discount && (
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl text-gray-500 line-through">
                      R$ {property.originalPrice}
                    </span>
                    <span className="bg-red-500 text-white px-2 py-1 rounded-full text-sm font-medium">
                      -{property.discount}%
                    </span>
                  </div>
                )}
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-gray-900">
                    R$ {property.price}
                  </span>
                  <span className="text-gray-600">/ noite</span>
                </div>
              </div>

              {/* Urgency Alert */}
              {property.occupancyRate > 80 && (
                <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="flex items-center gap-2 text-orange-800">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      {property.occupancyRate}% reservado este mês
                    </span>
                  </div>
                </div>
              )}

              {/* Date Selection */}
              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">
                    Datas
                  </label>
                  <button
                    onClick={() => setShowCalendar(true)}
                    className="w-full p-3 border rounded-lg text-left hover:border-blue-400 transition-colors"
                  >
                    {selectedDates.startDate && selectedDates.endDate ? (
                      <span>
                        {selectedDates.startDate.toLocaleDateString('pt-BR')} - {selectedDates.endDate.toLocaleDateString('pt-BR')}
                      </span>
                    ) : (
                      <span className="text-gray-500">Selecione as datas</span>
                    )}
                  </button>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">
                    Hóspedes
                  </label>
                  <select
                    value={guests}
                    onChange={(e) => setGuests(Number(e.target.value))}
                    className="w-full p-3 border rounded-lg"
                  >
                    {[...Array(property.guests)].map((_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {i + 1} {i === 0 ? 'hóspede' : 'hóspedes'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Price Breakdown */}
              {selectedDates.startDate && selectedDates.endDate && (
                <div className="space-y-2 pb-4 mb-4 border-b">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      R$ {property.price} x{' '}
                      {Math.ceil(
                        (selectedDates.endDate.getTime() - selectedDates.startDate.getTime()) /
                          (1000 * 60 * 60 * 24)
                      )}{' '}
                      noites
                    </span>
                    <span>R$ {calculateTotal()}</span>
                  </div>
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Taxa de limpeza</span>
                    <span>R$ 0</span>
                  </div>
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Taxa de serviço</span>
                    <span>R$ 0</span>
                  </div>
                  <div className="flex justify-between font-semibold text-lg pt-2">
                    <span>Total</span>
                    <span>R$ {calculateTotal()}</span>
                  </div>
                </div>
              )}

              {/* Reserve Button */}
              <Button
                onClick={handleReserve}
                disabled={!selectedDates.startDate || !selectedDates.endDate}
                className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold py-4 rounded-xl text-lg disabled:opacity-50"
              >
                {property.instantBooking ? 'Reservar Agora' : 'Solicitar Reserva'}
              </Button>

              {/* PIX Discount */}
              <div className="mt-4 p-3 bg-green-50 rounded-lg">
                <div className="flex items-center gap-2 text-green-800">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    Pague com PIX e ganhe 3% de cashback
                  </span>
                </div>
              </div>

              {/* Cancellation Policy */}
              <p className="text-xs text-gray-500 text-center mt-4">
                {property.cancellationPolicy}
              </p>

              {/* WhatsApp Support */}
              <button className="w-full mt-4 p-3 border border-green-300 rounded-lg text-green-600 hover:bg-green-50 transition-colors flex items-center justify-center gap-2">
                <MessageCircle className="w-5 h-5" />
                <span className="font-medium">Tirar dúvidas no WhatsApp</span>
              </button>
            </Card>
          </div>
        </div>

        {/* Host Section */}
        <div className="mt-12 py-8 border-t">
          <h3 className="text-xl font-semibold text-gray-900 mb-6">Conheça seu anfitrião</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card className="p-6">
              <div className="flex items-start gap-4">
                <div className="relative">
                  <Image
                    src={property.host.image}
                    alt={property.host.name}
                    width={80}
                    height={80}
                    className="rounded-full"
                  />
                  {property.host.superhost && (
                    <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
                      <Award className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <h4 className="text-lg font-semibold text-gray-900">{property.host.name}</h4>
                  <p className="text-sm text-gray-600">Anfitrião desde {property.host.joinedDate}</p>
                  <div className="flex items-center gap-4 mt-2 text-sm">
                    <span className="flex items-center gap-1">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      Identidade verificada
                    </span>
                    {property.host.superhost && (
                      <span className="flex items-center gap-1">
                        <Award className="w-4 h-4 text-purple-600" />
                        Superhost
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-6 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Taxa de resposta</span>
                  <span className="font-medium">{property.host.responseRate}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tempo de resposta</span>
                  <span className="font-medium">{property.host.responseTime}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Idiomas</span>
                  <span className="font-medium">{property.host.languages.join(', ')}</span>
                </div>
              </div>
            </Card>
            <div>
              <p className="text-gray-600 mb-6">{property.host.about}</p>
              <Button className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white">
                Enviar mensagem ao anfitrião
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Photo Gallery Modal */}
      {showAllPhotos && (
        <div className="fixed inset-0 bg-black z-50 overflow-y-auto">
          <div className="container mx-auto px-6 py-8">
            <button
              onClick={() => setShowAllPhotos(false)}
              className="fixed top-8 right-8 w-10 h-10 bg-white rounded-full flex items-center justify-center hover:bg-gray-100 z-50"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="space-y-4">
              {property.images.map((image, index) => (
                <Image
                  key={index}
                  src={image}
                  alt={`${property.title} ${index + 1}`}
                  width={1200}
                  height={800}
                  className="w-full rounded-lg"
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Calendar Modal */}
      {showCalendar && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowCalendar(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-4xl"
          >
            <AdvancedCalendar
              onDateSelect={(dates) => {
                setSelectedDates(dates)
                if (dates.startDate && dates.endDate) {
                  setShowCalendar(false)
                }
              }}
              className="w-full"
            />
          </div>
        </div>
      )}

      <Footer />
    </div>
  )
}
'use client'

import { motion } from 'framer-motion'
import { Shield, CheckCircle, Zap, Clock, Star, Users, Phone, Globe, Award, TrendingUp } from 'lucide-react'
import { Card } from './card'

// PIX Trust Badge Component
export function PixTrustBadge() {
  return (
    <div className="inline-flex items-center gap-2 bg-forest-50 border border-forest-200 rounded-lg px-3 py-2">
      <div className="w-6 h-6 bg-forest-500 rounded flex items-center justify-center">
        <Zap className="w-4 h-4 text-white" />
      </div>
      <div className="text-sm">
        <div className="font-semibold text-forest-800">PIX Instantâneo</div>
        <div className="text-forest-600 text-xs">Pagamento em segundos</div>
      </div>
    </div>
  )
}

// WhatsApp Support Badge
export function WhatsAppBadge() {
  return (
    <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
      <div className="w-6 h-6 bg-green-500 rounded flex items-center justify-center">
        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 2.079.549 4.112 1.595 5.936L0 24l6.256-1.612c1.741.943 3.706 1.444 5.761 1.444 6.621 0 11.988-5.367 11.988-11.988C23.988 5.384 18.638.017 12.017 0zm5.985 17.138c-.246.688-1.456 1.272-2.021 1.338-.564.065-1.299.146-3.767-.781-2.638-1.051-4.344-3.772-4.475-3.952-.131-.181-.889-1.18-.889-2.25 0-1.07.557-1.596.754-1.815.197-.218.43-.273.574-.273.144 0 .287.001.411.008.132.006.308-.051.481.367.197.479.674 1.634.732 1.753.058.118.097.256.02.414-.078.157-.117.256-.234.393-.118.137-.247.306-.354.411-.118.117-.24.243-.103.477.137.234.608 1.004 1.305 1.625.895.798 1.648 1.044 1.882 1.161.234.118.37.099.506-.059.137-.157.589-.688.746-.925.157-.234.315-.196.53-.118.216.079 1.366.644 1.601.762.234.118.39.177.448.275.059.099.059.573-.187 1.261z"/>
        </svg>
      </div>
      <div className="text-sm">
        <div className="font-semibold text-green-800">WhatsApp 24/7</div>
        <div className="text-green-600 text-xs">Suporte brasileiro</div>
      </div>
    </div>
  )
}

// Security Badge
export function SecurityBadge() {
  return (
    <div className="inline-flex items-center gap-2 bg-brand-50 border border-brand-200 rounded-lg px-3 py-2">
      <Shield className="w-6 h-6 text-brand-500" />
      <div className="text-sm">
        <div className="font-semibold text-brand-800">100% Seguro</div>
        <div className="text-brand-600 text-xs">SSL + Verificado</div>
      </div>
    </div>
  )
}

// Real-time Activity Component
export function RealTimeActivity({ activity = "47 pessoas visualizaram esta propriedade na última hora" }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="inline-flex items-center gap-2 bg-coral-50 border border-coral-200 rounded-full px-4 py-2"
    >
      <div className="w-2 h-2 bg-coral-500 rounded-full animate-pulse"></div>
      <span className="text-sm font-medium text-coral-800">{activity}</span>
    </motion.div>
  )
}

// Brazilian Testimonial Component
interface TestimonialProps {
  name: string
  location: string
  rating: number
  comment: string
  avatar?: string
}

export function BrazilianTestimonial({ name, location, rating, comment, avatar }: TestimonialProps) {
  return (
    <Card className="max-w-md bg-white border border-neutral-200 p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-gradient-to-br from-brand-400 to-forest-400 rounded-full flex items-center justify-center text-white font-semibold">
          {avatar || name.charAt(0)}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex">
              {[...Array(5)].map((_, i) => (
                <Star 
                  key={i} 
                  className={`w-4 h-4 ${i < rating ? 'text-luxury-400 fill-current' : 'text-neutral-300'}`} 
                />
              ))}
            </div>
            <span className="text-xs text-neutral-500">há 2 dias</span>
          </div>
          <p className="text-sm text-neutral-700 mb-2 leading-relaxed">"{comment}"</p>
          <div className="text-xs text-neutral-600">
            <strong>{name}</strong> • {location}
          </div>
        </div>
      </div>
    </Card>
  )
}

// Trust Statistics Bar
export function TrustStatsBar() {
  const stats = [
    { icon: Users, value: "250k+", label: "Hóspedes felizes" },
    { icon: Star, value: "4.9", label: "Nota média" },
    { icon: Clock, value: "30s", label: "Confirmação" },
    { icon: Shield, value: "100%", label: "Seguro" }
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: index * 0.1 }}
          className="text-center p-4 bg-white rounded-xl border border-neutral-200 hover:shadow-md transition-shadow"
        >
          <stat.icon className="w-6 h-6 mx-auto mb-2 text-brand-500" />
          <div className="text-2xl font-bold text-neutral-900">{stat.value}</div>
          <div className="text-sm text-neutral-600">{stat.label}</div>
        </motion.div>
      ))}
    </div>
  )
}

// Booking Urgency Component
interface UrgencyProps {
  type?: 'limited-time' | 'high-demand' | 'last-rooms'
  message: string
  timeLeft?: string
}

export function BookingUrgency({ type = 'high-demand', message, timeLeft }: UrgencyProps) {
  const variants = {
    'limited-time': { bg: 'bg-coral-50', border: 'border-coral-200', text: 'text-coral-800', icon: Clock },
    'high-demand': { bg: 'bg-brand-50', border: 'border-brand-200', text: 'text-brand-800', icon: TrendingUp },
    'last-rooms': { bg: 'bg-luxury-50', border: 'border-luxury-200', text: 'text-luxury-800', icon: Users }
  }

  const variant = variants[type]
  const IconComponent = variant.icon

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={`inline-flex items-center gap-3 ${variant.bg} ${variant.border} border rounded-lg px-4 py-3`}
    >
      <IconComponent className={`w-5 h-5 ${variant.text}`} />
      <div>
        <div className={`text-sm font-semibold ${variant.text}`}>{message}</div>
        {timeLeft && (
          <div className="text-xs text-neutral-600">Restam: {timeLeft}</div>
        )}
      </div>
    </motion.div>
  )
}

// Brazilian Partnership Badges
export function PartnershipBadges() {
  const partners = [
    { name: "ABAV", desc: "Agência Brasileira de Viagens" },
    { name: "Embratur", desc: "Instituto Brasileiro de Turismo" },
    { name: "BACEN", desc: "Banco Central do Brasil" }
  ]

  return (
    <div className="flex flex-wrap justify-center gap-4">
      {partners.map((partner) => (
        <div 
          key={partner.name}
          className="inline-flex items-center gap-2 bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2"
        >
          <Award className="w-4 h-4 text-neutral-600" />
          <div className="text-xs">
            <div className="font-semibold text-neutral-800">{partner.name}</div>
            <div className="text-neutral-600">{partner.desc}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

// Social Proof Ticker
export function SocialProofTicker() {
  const recentBookings = [
    { name: "Maria", location: "São Paulo", time: "2 min" },
    { name: "João", location: "Rio de Janeiro", time: "5 min" },
    { name: "Ana", location: "Belo Horizonte", time: "8 min" },
    { name: "Carlos", location: "Salvador", time: "12 min" }
  ]

  return (
    <div className="bg-forest-50 border border-forest-200 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 bg-forest-500 rounded-full animate-pulse"></div>
        <span className="text-sm font-semibold text-forest-800">Reservas em tempo real</span>
      </div>
      <div className="space-y-2">
        {recentBookings.map((booking, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.2 }}
            className="flex items-center justify-between text-sm"
          >
            <span className="text-neutral-700">
              <strong>{booking.name}</strong> de {booking.location}
            </span>
            <span className="text-neutral-500">{booking.time} atrás</span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
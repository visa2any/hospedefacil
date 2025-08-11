'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { 
  CheckCircle, Download, MessageCircle, Calendar, MapPin,
  Users, Home, Mail, Phone, Star, Copy, Share2, Sparkles
} from 'lucide-react'
import { Header } from '../../components/layout/header'
import { Footer } from '../../components/layout/footer'
import { Button } from '../../components/ui/button'
import { Card } from '../../components/ui/card'
import Link from 'next/link'
import confetti from 'canvas-confetti'

export default function BookingSuccessPage() {
  const router = useRouter()
  const [copied, setCopied] = useState(false)
  
  // Booking details - would come from API/context
  const booking = {
    id: 'HF2024112301',
    property: 'Cobertura Vista Mar em Copacabana',
    location: 'Rio de Janeiro, RJ',
    checkin: '25/11/2024',
    checkout: '28/11/2024',
    guests: 2,
    total: 1305.00,
    paymentMethod: 'PIX',
    host: {
      name: 'Carlos Silva',
      phone: '+55 11 98765-4321'
    }
  }

  // Confetti animation on mount
  useEffect(() => {
    const duration = 3 * 1000
    const animationEnd = Date.now() + duration
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 }

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min
    }

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now()

      if (timeLeft <= 0) {
        return clearInterval(interval)
      }

      const particleCount = 50 * (timeLeft / duration)
      
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      })
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      })
    }, 250)

    return () => clearInterval(interval)
  }, [])

  const copyBookingId = () => {
    navigator.clipboard.writeText(booking.id)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleWhatsApp = () => {
    const message = `Olá! Acabei de fazer uma reserva no HospedeFácil.
    
Código da Reserva: ${booking.id}
Propriedade: ${booking.property}
Check-in: ${booking.checkin}
Check-out: ${booking.checkout}

Gostaria de confirmar os detalhes!`
    
    window.open(`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT}?text=${encodeURIComponent(message)}`, '_blank')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      <Header />

      <div className="container mx-auto px-6 py-12">
        {/* Success Animation */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center justify-center w-24 h-24 bg-green-100 rounded-full mb-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
            >
              <CheckCircle className="w-12 h-12 text-green-600" />
            </motion.div>
          </div>
          
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Reserva Confirmada! 🎉
          </h1>
          
          <p className="text-xl text-gray-600 mb-2">
            Sua hospedagem está garantida
          </p>
          
          <div className="inline-flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm">
            <span className="text-sm text-gray-600">Código da reserva:</span>
            <span className="font-mono font-bold text-gray-900">{booking.id}</span>
            <button
              onClick={copyBookingId}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
            >
              {copied ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : (
                <Copy className="w-4 h-4 text-gray-500" />
              )}
            </button>
          </div>
        </motion.div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* Booking Details */}
          <div className="lg:col-span-2">
            <Card className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <Sparkles className="w-6 h-6 text-yellow-500" />
                <h2 className="text-2xl font-semibold text-gray-900">
                  Detalhes da Reserva
                </h2>
              </div>

              {/* Property Info */}
              <div className="mb-8 pb-8 border-b">
                <h3 className="font-semibold text-gray-900 text-lg mb-3">
                  {booking.property}
                </h3>
                <div className="space-y-2 text-gray-600">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    <span>{booking.location}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Home className="w-4 h-4" />
                    <span>Anfitrião: {booking.host.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    <span>{booking.host.phone}</span>
                  </div>
                </div>
              </div>

              {/* Stay Details */}
              <div className="mb-8 pb-8 border-b">
                <h3 className="font-semibold text-gray-900 mb-4">Detalhes da Estadia</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2 text-gray-600 mb-1">
                      <Calendar className="w-4 h-4" />
                      <span className="text-sm">Check-in</span>
                    </div>
                    <p className="font-semibold text-gray-900">{booking.checkin}</p>
                    <p className="text-sm text-gray-600">A partir das 14:00</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2 text-gray-600 mb-1">
                      <Calendar className="w-4 h-4" />
                      <span className="text-sm">Check-out</span>
                    </div>
                    <p className="font-semibold text-gray-900">{booking.checkout}</p>
                    <p className="text-sm text-gray-600">Até às 11:00</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2 text-gray-600 mb-1">
                      <Users className="w-4 h-4" />
                      <span className="text-sm">Hóspedes</span>
                    </div>
                    <p className="font-semibold text-gray-900">{booking.guests} pessoas</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2 text-gray-600 mb-1">
                      <Star className="w-4 h-4" />
                      <span className="text-sm">Total Pago</span>
                    </div>
                    <p className="font-semibold text-gray-900">R$ {booking.total.toFixed(2)}</p>
                    <p className="text-sm text-green-600">via {booking.paymentMethod}</p>
                  </div>
                </div>
              </div>

              {/* Important Info */}
              <div className="mb-8">
                <h3 className="font-semibold text-gray-900 mb-4">Informações Importantes</h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-gray-900">Confirmação enviada por e-mail</p>
                      <p className="text-sm text-gray-600">
                        Verifique sua caixa de entrada e spam
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-gray-900">Check-in autônomo disponível</p>
                      <p className="text-sm text-gray-600">
                        Instruções serão enviadas 24h antes
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-gray-900">Cancelamento gratuito até 48h antes</p>
                      <p className="text-sm text-gray-600">
                        Após esse prazo, consulte a política
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  onClick={() => window.print()}
                  variant="outline"
                  className="flex-1"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Baixar Comprovante
                </Button>
                <Button
                  onClick={handleWhatsApp}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Falar no WhatsApp
                </Button>
              </div>
            </Card>
          </div>

          {/* Next Steps */}
          <div className="lg:col-span-1">
            <Card className="p-6 sticky top-24">
              <h3 className="font-semibold text-gray-900 mb-4">Próximos Passos</h3>
              
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-blue-600">1</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Verifique seu e-mail</p>
                    <p className="text-sm text-gray-600">
                      Enviamos todos os detalhes da reserva
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-blue-600">2</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Salve o contato do anfitrião</p>
                    <p className="text-sm text-gray-600">
                      Para facilitar a comunicação
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-blue-600">3</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Aguarde as instruções</p>
                    <p className="text-sm text-gray-600">
                      24h antes do check-in você receberá tudo
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-blue-600">4</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Aproveite sua estadia!</p>
                    <p className="text-sm text-gray-600">
                      E não esqueça de avaliar depois
                    </p>
                  </div>
                </div>
              </div>

              {/* Share */}
              <div className="mt-6 pt-6 border-t">
                <p className="text-sm font-medium text-gray-900 mb-3">
                  Compartilhe sua viagem
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      navigator.share({
                        title: 'Minha reserva no HospedeFácil',
                        text: `Acabei de reservar ${booking.property} para ${booking.checkin}!`,
                        url: window.location.href
                      })
                    }}
                  >
                    <Share2 className="w-4 h-4 mr-1" />
                    Compartilhar
                  </Button>
                </div>
              </div>

              {/* Support */}
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm font-medium text-blue-900 mb-2">
                  Precisa de ajuda?
                </p>
                <p className="text-sm text-blue-700 mb-3">
                  Nosso suporte está disponível 24/7
                </p>
                <Button
                  size="sm"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => window.open(`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT}`, '_blank')}
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Falar com Suporte
                </Button>
              </div>
            </Card>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="max-w-6xl mx-auto mt-8">
          <Card className="p-6 bg-gradient-to-r from-blue-50 to-purple-50">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">
                  Que tal já planejar a próxima viagem?
                </h3>
                <p className="text-sm text-gray-600">
                  Descubra novos destinos incríveis com ofertas exclusivas
                </p>
              </div>
              <div className="flex gap-3">
                <Link href="/search">
                  <Button className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white">
                    Explorar Destinos
                  </Button>
                </Link>
                <Link href="/">
                  <Button variant="outline">
                    Voltar ao Início
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Footer />
    </div>
  )
}
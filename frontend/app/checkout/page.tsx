'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { 
  ChevronLeft, Shield, Clock, CheckCircle, AlertTriangle,
  CreditCard, Smartphone, Copy, QrCode, Star, MapPin,
  Calendar, Users, Info, Lock, Zap
} from 'lucide-react'
import { Header } from '../../components/layout/header'
import { Footer } from '../../components/layout/footer'
import { Button } from '../../components/ui/button'
import { Card } from '../../components/ui/card'
import { Input } from '../../components/ui/input'
import Link from 'next/link'

// Mock property data - would come from API based on propertyId
const getPropertyData = (id: string) => ({
  id,
  title: 'Cobertura Vista Mar em Copacabana',
  location: 'Rio de Janeiro, RJ',
  image: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800',
  rating: 4.95,
  reviews: 234,
  host: 'Carlos Silva'
})

function CheckoutContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [paymentMethod, setPaymentMethod] = useState('pix')
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    cpf: '',
    specialRequests: ''
  })
  const [isProcessing, setIsProcessing] = useState(false)
  const [showPixModal, setShowPixModal] = useState(false)
  const [pixCopied, setPixCopied] = useState(false)
  const [secondsRemaining, setSecondsRemaining] = useState(600) // 10 minutes for PIX

  const propertyId = searchParams.get('propertyId') || '1'
  const checkin = searchParams.get('checkin')
  const checkout = searchParams.get('checkout')
  const guests = searchParams.get('guests') || '2'
  const total = searchParams.get('total') || '900'

  const property = getPropertyData(propertyId)
  const nights = checkin && checkout 
    ? Math.ceil((new Date(checkout).getTime() - new Date(checkin).getTime()) / (1000 * 60 * 60 * 24))
    : 2

  // PIX payment timer
  useEffect(() => {
    if (showPixModal && secondsRemaining > 0) {
      const timer = setInterval(() => {
        setSecondsRemaining(prev => prev - 1)
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [showPixModal, secondsRemaining])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsProcessing(true)

    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 2000))

    if (paymentMethod === 'pix') {
      setShowPixModal(true)
    } else {
      // For credit card, redirect to success
      router.push('/booking-success')
    }
    
    setIsProcessing(false)
  }

  const copyPixKey = () => {
    navigator.clipboard.writeText('00020126360014BR.GOV.BCB.PIX0114+5511999999999')
    setPixCopied(true)
    setTimeout(() => setPixCopied(false), 2000)
  }

  const pixDiscount = paymentMethod === 'pix' ? Number(total) * 0.03 : 0
  const finalTotal = Number(total) - pixDiscount

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      {/* Progress Bar */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
                ✓
              </div>
              <span className="text-sm font-medium text-gray-900">Busca</span>
            </div>
            <div className="w-16 h-1 bg-green-500"></div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
                ✓
              </div>
              <span className="text-sm font-medium text-gray-900">Seleção</span>
            </div>
            <div className="w-16 h-1 bg-blue-500"></div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
                3
              </div>
              <span className="text-sm font-medium text-gray-900">Pagamento</span>
            </div>
            <div className="w-16 h-1 bg-gray-300"></div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gray-300 text-gray-600 rounded-full flex items-center justify-center text-sm font-medium">
                4
              </div>
              <span className="text-sm text-gray-600">Confirmação</span>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        <Link href={`/property/${propertyId}`} className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6">
          <ChevronLeft className="w-4 h-4" />
          <span>Voltar aos detalhes</span>
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit}>
              {/* Guest Information */}
              <Card className="p-6 mb-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Informações do Hóspede</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nome Completo *
                    </label>
                    <Input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      placeholder="João Silva"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      E-mail *
                    </label>
                    <Input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      placeholder="joao@email.com"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Telefone *
                    </label>
                    <Input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      required
                      placeholder="(11) 98765-4321"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      CPF *
                    </label>
                    <Input
                      type="text"
                      name="cpf"
                      value={formData.cpf}
                      onChange={handleInputChange}
                      required
                      placeholder="123.456.789-00"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pedidos Especiais (Opcional)
                  </label>
                  <textarea
                    name="specialRequests"
                    value={formData.specialRequests}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="Ex: Check-in tardio, berço para bebê..."
                  />
                </div>
              </Card>

              {/* Payment Method */}
              <Card className="p-6 mb-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Forma de Pagamento</h2>
                
                <div className="space-y-4">
                  {/* PIX Option */}
                  <label className="relative flex items-start gap-4 p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="radio"
                      name="payment"
                      value="pix"
                      checked={paymentMethod === 'pix'}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Smartphone className="w-5 h-5 text-green-600" />
                        <span className="font-semibold text-gray-900">PIX</span>
                        <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-medium">
                          3% de desconto
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">
                        Pagamento instantâneo com código PIX. Confirmação em segundos.
                      </p>
                      {paymentMethod === 'pix' && (
                        <div className="mt-3 p-3 bg-green-50 rounded-lg">
                          <p className="text-sm text-green-800">
                            💰 Você economiza <strong>R$ {pixDiscount.toFixed(2)}</strong> pagando com PIX!
                          </p>
                        </div>
                      )}
                    </div>
                  </label>

                  {/* Credit Card Option */}
                  <label className="relative flex items-start gap-4 p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="radio"
                      name="payment"
                      value="credit"
                      checked={paymentMethod === 'credit'}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <CreditCard className="w-5 h-5 text-blue-600" />
                        <span className="font-semibold text-gray-900">Cartão de Crédito</span>
                      </div>
                      <p className="text-sm text-gray-600">
                        Parcelamento em até 12x sem juros. Processamento seguro.
                      </p>
                    </div>
                  </label>
                </div>

                {paymentMethod === 'credit' && (
                  <div className="mt-6 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Número do Cartão
                      </label>
                      <Input
                        type="text"
                        placeholder="1234 5678 9012 3456"
                        className="font-mono"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Validade
                        </label>
                        <Input
                          type="text"
                          placeholder="MM/AA"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          CVV
                        </label>
                        <Input
                          type="text"
                          placeholder="123"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </Card>

              {/* Terms and Conditions */}
              <Card className="p-6 mb-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Termos e Condições</h2>
                
                <div className="space-y-3">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      required
                      className="mt-1"
                    />
                    <span className="text-sm text-gray-600">
                      Concordo com os <a href="#" className="text-blue-600 hover:underline">Termos de Uso</a> e 
                      a <a href="#" className="text-blue-600 hover:underline">Política de Privacidade</a> do HospedeFácil.
                    </span>
                  </label>
                  
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      required
                      className="mt-1"
                    />
                    <span className="text-sm text-gray-600">
                      Entendo a <a href="#" className="text-blue-600 hover:underline">Política de Cancelamento</a> desta reserva.
                    </span>
                  </label>
                </div>
              </Card>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isProcessing}
                className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold py-4 rounded-xl text-lg disabled:opacity-50"
              >
                {isProcessing ? (
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processando...
                  </div>
                ) : (
                  <>
                    <Lock className="w-5 h-5 mr-2" />
                    Confirmar e Pagar R$ {finalTotal.toFixed(2)}
                  </>
                )}
              </Button>

              {/* Security Badge */}
              <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-600">
                <Shield className="w-4 h-4 text-green-600" />
                <span>Pagamento 100% seguro e criptografado</span>
              </div>
            </form>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Resumo da Reserva</h3>
              
              {/* Property Info */}
              <div className="flex gap-4 mb-6 pb-6 border-b">
                <Image
                  src={property.image}
                  alt={property.title}
                  width={100}
                  height={80}
                  className="rounded-lg object-cover"
                />
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 line-clamp-2">{property.title}</h4>
                  <div className="flex items-center gap-1 text-sm text-gray-600 mt-1">
                    <MapPin className="w-3 h-3" />
                    {property.location}
                  </div>
                  <div className="flex items-center gap-1 text-sm mt-1">
                    <Star className="w-3 h-3 text-yellow-500 fill-current" />
                    <span className="font-medium">{property.rating}</span>
                    <span className="text-gray-500">({property.reviews})</span>
                  </div>
                </div>
              </div>

              {/* Booking Details */}
              <div className="space-y-3 mb-6 pb-6 border-b">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Check-in
                  </span>
                  <span className="font-medium">
                    {checkin ? new Date(checkin).toLocaleDateString('pt-BR') : 'A definir'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Check-out
                  </span>
                  <span className="font-medium">
                    {checkout ? new Date(checkout).toLocaleDateString('pt-BR') : 'A definir'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    Hóspedes
                  </span>
                  <span className="font-medium">{guests}</span>
                </div>
              </div>

              {/* Price Breakdown */}
              <div className="space-y-2 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">
                    R$ {(Number(total) / nights).toFixed(2)} x {nights} noites
                  </span>
                  <span>R$ {total}</span>
                </div>
                <div className="flex justify-between text-sm text-green-600">
                  <span>Taxa de limpeza</span>
                  <span>R$ 0</span>
                </div>
                <div className="flex justify-between text-sm text-green-600">
                  <span>Taxa de serviço</span>
                  <span>R$ 0</span>
                </div>
                {paymentMethod === 'pix' && (
                  <div className="flex justify-between text-sm text-green-600 font-medium">
                    <span>Desconto PIX (3%)</span>
                    <span>- R$ {pixDiscount.toFixed(2)}</span>
                  </div>
                )}
                <div className="pt-2 border-t">
                  <div className="flex justify-between font-semibold text-lg">
                    <span>Total</span>
                    <span className="text-blue-600">R$ {finalTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Benefits */}
              <div className="space-y-2">
                <div className="flex items-start gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600">Cancelamento gratuito até 48h antes</span>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600">Confirmação instantânea</span>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600">Suporte 24h via WhatsApp</span>
                </div>
              </div>

              {/* Help */}
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="w-4 h-4 text-blue-600" />
                  <span className="font-medium text-blue-800">Precisa de ajuda?</span>
                </div>
                <p className="text-sm text-blue-700">
                  Fale conosco pelo WhatsApp:
                  <br />
                  <a href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT}`} className="font-medium underline">
                    (11) 98765-4321
                  </a>
                </p>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* PIX Payment Modal */}
      {showPixModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl max-w-md w-full p-6"
          >
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Pagamento PIX</h3>
              <p className="text-gray-600">Escaneie o código ou copie a chave PIX</p>
            </div>

            {/* QR Code Placeholder */}
            <div className="bg-gray-100 rounded-lg p-8 mb-6 flex items-center justify-center">
              <QrCode className="w-32 h-32 text-gray-400" />
            </div>

            {/* PIX Key */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Chave PIX (Copia e Cola)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value="00020126360014BR.GOV.BCB.PIX0114+5511999999999"
                  readOnly
                  className="flex-1 px-3 py-2 border rounded-lg bg-gray-50 text-sm font-mono"
                />
                <Button
                  onClick={copyPixKey}
                  variant="outline"
                  className="px-4"
                >
                  {pixCopied ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Timer */}
            <div className="mb-6 p-4 bg-orange-50 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-orange-800">
                  Tempo restante para pagamento
                </span>
                <span className="text-lg font-bold text-orange-900">
                  {formatTime(secondsRemaining)}
                </span>
              </div>
            </div>

            {/* Amount */}
            <div className="mb-6 text-center">
              <p className="text-sm text-gray-600 mb-1">Valor a pagar</p>
              <p className="text-3xl font-bold text-gray-900">
                R$ {finalTotal.toFixed(2)}
              </p>
              <p className="text-sm text-green-600 mt-1">
                Você economizou R$ {pixDiscount.toFixed(2)} com PIX!
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowPixModal(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={() => router.push('/booking-success')}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              >
                Já Paguei
              </Button>
            </div>

            <p className="text-xs text-gray-500 text-center mt-4">
              Após o pagamento, a confirmação é automática
            </p>
          </motion.div>
        </div>
      )}

      <Footer />
    </div>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  )
}
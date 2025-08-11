'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle, Star, Users, Calendar } from 'lucide-react'
import { Button } from '../ui/button'

const features = [
  {
    title: "🎯 Calendário Inteligente",
    description: "Date picker com preços por noite, como Airbnb",
    implemented: true
  },
  {
    title: "🗺️ Autocomplete Brasileiro",
    description: "20+ destinos populares com preços e social proof",
    implemented: true
  },
  {
    title: "🔥 Urgência em Tempo Real",
    description: "Notificações dinâmicas de atividade",
    implemented: true
  },
  {
    title: "🎨 Botão Otimizado",
    description: "Cor laranja/vermelha (+35% conversão)",
    implemented: true
  },
  {
    title: "📱 Mobile-First",
    description: "Layout responsivo otimizado",
    implemented: true
  },
  {
    title: "💳 PIX + WhatsApp",
    description: "Diferenciais brasileiros integrados",
    implemented: true
  }
]

export function SearchDemo() {
  const [currentFeature, setCurrentFeature] = useState(0)

  return (
    <div className="bg-gradient-to-br from-blue-50 to-purple-50 p-8 rounded-3xl max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          🚀 HospedeFácil: Competindo com os Gigantes
        </h2>
        <p className="text-lg text-gray-600">
          Implementamos as melhores práticas do Airbnb, Booking.com e VRBO
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {features.map((feature, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`p-6 rounded-2xl border-2 transition-all duration-300 cursor-pointer ${
              currentFeature === index
                ? 'bg-white border-blue-400 shadow-lg'
                : 'bg-white/50 border-gray-200 hover:border-blue-200'
            }`}
            onClick={() => setCurrentFeature(index)}
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">{feature.title.split(' ')[0]}</span>
              <h3 className="font-semibold text-gray-900">
                {feature.title.substring(3)}
              </h3>
              {feature.implemented && (
                <CheckCircle className="w-5 h-5 text-green-500 ml-auto" />
              )}
            </div>
            <p className="text-gray-600 text-sm">
              {feature.description}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">+35%</div>
          <div className="text-sm text-gray-600">Conversão com cor laranja</div>
        </div>
        <div className="bg-white rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-green-600">18s</div>
          <div className="text-sm text-gray-600">Confirmação média</div>
        </div>
        <div className="bg-white rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-purple-600">10%</div>
          <div className="text-sm text-gray-600">Comissão vs 15-20%</div>
        </div>
        <div className="bg-white rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-orange-600">4.95★</div>
          <div className="text-sm text-gray-600">127k avaliações</div>
        </div>
      </div>

      {/* Action */}
      <div className="text-center">
        <Button className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold px-8 py-4 rounded-2xl text-lg">
          🎯 Testar Search Form Otimizado
        </Button>
        <p className="text-sm text-gray-500 mt-3">
          Scroll para cima para ver o search form redesenhado
        </p>
      </div>
    </div>
  )
}
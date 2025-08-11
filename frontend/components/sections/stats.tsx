'use client'

import { motion } from 'framer-motion'
import { TrendingUp, Users, Star, Shield, Zap, Heart, Clock, MapPin } from 'lucide-react'

const stats = [
  {
    icon: Users,
    number: '847.293',
    label: 'Viajantes Felizes',
    description: 'Hospedados em 2024',
    highlight: true
  },
  {
    icon: Star,
    number: '4.95',
    label: 'Nota Média',
    description: '127.843 avaliações reais',
    highlight: false
  },
  {
    icon: Zap,
    number: '18seg',
    label: 'Confirmação Média',
    description: 'Record brasileiro',
    highlight: true
  },
  {
    icon: MapPin,
    number: '2.847',
    label: 'Cidades Atendidas',
    description: 'Em todo o território nacional',
    highlight: false
  },
  {
    icon: Shield,
    number: '100%',
    label: 'Pagamento Seguro',
    description: 'PIX instantâneo verificado',
    highlight: false
  },
  {
    icon: Clock,
    number: '24h',
    label: 'Suporte WhatsApp',
    description: 'Atendimento em português',
    highlight: false
  }
]

export function Stats() {
  return (
    <section className="py-24 bg-white">
      <div className="container mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-full px-4 py-2 mb-6">
            <TrendingUp className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-medium text-blue-700">Números que Falam Por Si</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-neutral-900 mb-6">
            O Brasil Confia em Nós
          </h2>
          <p className="text-xl text-neutral-600 max-w-3xl mx-auto leading-relaxed">
            Mais de 800 mil brasileiros já escolheram o HospedeFácil para suas viagens. 
            Veja por que somos a plataforma que mais cresce no país.
          </p>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-8">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
              className={`relative text-center p-6 rounded-2xl border transition-all duration-300 hover:scale-105 ${
                stat.highlight 
                  ? 'bg-gradient-to-br from-blue-50 to-green-50 border-blue-200 shadow-lg' 
                  : 'bg-white border-neutral-200 hover:border-neutral-300 hover:shadow-md'
              }`}
            >
              {stat.highlight && (
                <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                  <div className="bg-purple-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                    DESTAQUE
                  </div>
                </div>
              )}
              
              <div className={`w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center ${
                stat.highlight 
                  ? 'bg-gradient-to-br from-blue-500 to-green-500 shadow-md' 
                  : 'bg-neutral-100'
              }`}>
                <stat.icon className={`w-7 h-7 ${
                  stat.highlight ? 'text-white' : 'text-neutral-600'
                }`} />
              </div>
              
              <div className={`text-3xl font-bold mb-2 ${
                stat.highlight ? 'text-blue-600' : 'text-neutral-900'
              }`}>
                {stat.number}
              </div>
              
              <div className="font-semibold text-neutral-900 mb-1">
                {stat.label}
              </div>
              
              <div className="text-sm text-neutral-600">
                {stat.description}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Social Proof Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          viewport={{ once: true }}
          className="mt-16 text-center"
        >
          <div className="bg-green-50 border border-green-200 rounded-2xl p-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Heart className="w-5 h-5 text-green-500" />
              <span className="font-semibold text-green-800">Confiança Real</span>
            </div>
            <p className="text-lg text-neutral-700 mb-6">
              "Desde 2023, mais de <strong className="text-green-600">18.000 novas famílias</strong> se cadastram no HospedeFácil todo mês. 
              É a prova de que estamos no caminho certo."
            </p>
            <div className="flex flex-wrap justify-center gap-8 text-sm text-neutral-600">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span><strong>347 reservas</strong> nas últimas 24h</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <span><strong>89% dos hóspedes</strong> voltam a usar</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
                <span><strong>92% recomendam</strong> para amigos</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
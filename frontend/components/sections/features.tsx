'use client'

import { motion } from 'framer-motion'
import { Zap, Shield, Heart, Clock, Smartphone, Bot, CreditCard, Users } from 'lucide-react'

const features = [
  {
    icon: Zap,
    title: 'Reserva em 3 Cliques',
    description: 'Sistema mais rápido do Brasil. Confirme sua hospedagem em segundos, sem complicação.',
    color: 'text-yellow-500'
  },
  {
    icon: CreditCard,
    title: 'PIX Instantâneo',
    description: 'Pagamento via PIX com confirmação imediata. Sem taxas ocultas, sem burocracia.',
    color: 'text-green-500'
  },
  {
    icon: Smartphone,
    title: 'WhatsApp Nativo',
    description: 'Suporte 24/7 direto no WhatsApp. Fale com hosts e nossa equipe sem sair do app.',
    color: 'text-blue-500'
  },
  {
    icon: Bot,
    title: 'IA Brasileira',
    description: 'Assistente virtual que entende português e a cultura brasileira. Recomendações personalizadas.',
    color: 'text-purple-500'
  },
  {
    icon: Shield,
    title: '100% Seguro',
    description: 'Verificação rigorosa de propriedades e hosts. Sua segurança é nossa prioridade.',
    color: 'text-red-500'
  },
  {
    icon: Clock,
    title: 'Receba em 2 Dias',
    description: 'Hosts recebem em até 2 dias úteis. Muito mais rápido que outras plataformas.',
    color: 'text-indigo-500'
  },
  {
    icon: Heart,
    title: 'Feito para o Brasil',
    description: 'Desenvolvido pensando no brasileiro, com features que fazem sentido para nosso país.',
    color: 'text-pink-500'
  },
  {
    icon: Users,
    title: 'Comunidade Ativa',
    description: 'Mais de 50.000 hosts verificados em todo território nacional.',
    color: 'text-teal-500'
  }
]

export function Features() {
  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Por que escolher o HospedeFácil?
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            A única plataforma de hospedagem verdadeiramente brasileira. Feita por brasileiros, para brasileiros.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="text-center group"
            >
              <div className="relative mb-6">
                <div className="w-16 h-16 mx-auto bg-gray-50 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <feature.icon className={`w-8 h-8 ${feature.color}`} />
                </div>
                <div className="absolute inset-0 w-16 h-16 mx-auto bg-gradient-to-br from-blue-100 to-blue-200 rounded-full opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
              </div>
              
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                {feature.title}
              </h3>
              
              <p className="text-gray-600 leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Additional CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          viewport={{ once: true }}
          className="text-center mt-16 p-8 bg-gradient-to-r from-blue-50 to-green-50 rounded-2xl"
        >
          <h3 className="text-2xl font-bold text-gray-900 mb-4">
            Comissão mais baixa do mercado
          </h3>
          <p className="text-lg text-gray-600 mb-2">
            Cobramos apenas <span className="font-bold text-blue-600">10%</span> vs 15-20% da concorrência
          </p>
          <p className="text-sm text-gray-500">
            Mais dinheiro no seu bolso, mais valor para seus hóspedes
          </p>
        </motion.div>
      </div>
    </section>
  )
}
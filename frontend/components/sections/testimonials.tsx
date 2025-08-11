'use client'

import { motion } from 'framer-motion'
import { Star, Quote, Shield, Users } from 'lucide-react'
import { Card } from '../ui/card'

const testimonials = [
  {
    id: 1,
    name: 'Maria Silva',
    role: 'Host em São Paulo',
    rating: 5,
    content: 'Migrei do Airbnb para o HospedeFácil e não me arrependo. Recebo meus pagamentos em 2 dias e a comissão é muito menor. O suporte no WhatsApp é excelente!',
    avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=100'
  },
  {
    id: 2,
    name: 'João Santos',
    role: 'Viajante Frequente',
    rating: 5,
    content: 'Uso o HospedeFácil há 2 anos. A velocidade da reserva é impressionante e o pagamento via PIX é muito prático. Nunca tive problemas.',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100'
  },
  {
    id: 3,
    name: 'Ana Costa',
    role: 'Host no Rio de Janeiro',
    rating: 5,
    content: 'A IA do HospedeFácil me ajuda muito com as descrições das propriedades e resposta aos hóspedes. É como ter um assistente 24 horas!',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100'
  },
  {
    id: 4,
    name: 'Carlos Oliveira',
    role: 'Empresário',
    rating: 5,
    content: 'Gerencio 15 propriedades pelo HospedeFácil. O dashboard é muito completo e as integrações funcionam perfeitamente. Recomendo!',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100'
  },
  {
    id: 5,
    name: 'Lucia Ferreira',
    role: 'Host em Salvador',
    rating: 5,
    content: 'O que mais gosto é do atendimento humanizado. Quando preciso de ajuda, sempre tem alguém disponível no WhatsApp. Isso faz toda diferença.',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100'
  },
  {
    id: 6,
    name: 'Pedro Almeida',
    role: 'Investidor Imobiliário',
    rating: 5,
    content: 'Utilizo para meus 8 imóveis de investimento. A análise de mercado e sugestões de preço da IA são muito precisas. ROI aumentou 40%.',
    avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=100'
  }
]

export function Testimonials() {
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
            O que dizem nossos usuários
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Mais de 100.000 brasileiros confiam no HospedeFácil
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <Card className="p-6 h-full hover:shadow-lg transition-shadow duration-300 relative">
                <Quote className="absolute top-4 right-4 w-8 h-8 text-gray-300" />
                
                <div className="flex items-center gap-4 mb-4">
                  <img
                    src={testimonial.avatar}
                    alt={testimonial.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  <div>
                    <h4 className="font-semibold text-gray-900">
                      {testimonial.name}
                    </h4>
                    <p className="text-sm text-gray-600">
                      {testimonial.role}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 text-yellow-500 fill-current" />
                  ))}
                </div>

                <p className="text-gray-700 leading-relaxed">
                  "{testimonial.content}"
                </p>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Trust indicators */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          viewport={{ once: true }}
          className="text-center mt-16"
        >
          <div className="flex flex-wrap justify-center items-center gap-8 opacity-60">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              <span className="text-sm font-medium">Certificado ISO 27001</span>
            </div>
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5" />
              <span className="text-sm font-medium">Reclame Aqui: Excelente</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              <span className="text-sm font-medium">+1M usuários ativos</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
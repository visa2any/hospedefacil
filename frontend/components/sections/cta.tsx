'use client'

import { motion } from 'framer-motion'
import { ArrowRight, Download, Smartphone, Zap } from 'lucide-react'
import { Button } from '../ui/button'

export function CTA() {
  return (
    <section className="py-20 bg-gradient-to-br from-brand-600 via-brand-700 to-brand-800 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0 bg-[url('/pattern.svg')] bg-repeat"></div>
      </div>

      {/* Floating Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute top-1/4 left-1/4 w-32 h-32 bg-white rounded-full blur-3xl opacity-10"
          animate={{
            x: [0, 50, 0],
            y: [0, -30, 0],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-24 h-24 bg-yellow-400 rounded-full blur-2xl opacity-20"
          animate={{
            x: [0, -40, 0],
            y: [0, 40, 0],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="mb-8"
          >
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-6 py-3 mb-6">
              <Zap className="w-5 h-5 text-yellow-400" />
              <span className="text-sm font-medium text-white">
                Lançamento Nacional
              </span>
            </div>

            <h2 className="text-5xl md:text-6xl font-bold text-white mb-6">
              Comece a ganhar mais
              <br />
              <span className="text-yellow-400">hoje mesmo</span>
            </h2>

            <p className="text-xl text-brand-100 mb-8 max-w-2xl mx-auto">
              Junte-se a milhares de hosts que já escolheram a plataforma mais avançada do Brasil
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            viewport={{ once: true }}
            className="flex flex-col sm:flex-row gap-4 justify-center mb-12"
          >
            <Button 
              size="lg" 
              className="bg-white text-brand-700 hover:bg-gray-50 font-semibold px-8 py-4 text-lg flex items-center gap-2"
            >
              Cadastre sua Propriedade
              <ArrowRight className="w-5 h-5" />
            </Button>

            <Button 
              variant="outline" 
              size="lg"
              className="border-2 border-white text-white hover:bg-white/10 font-semibold px-8 py-4 text-lg flex items-center gap-2"
            >
              <Download className="w-5 h-5" />
              Baixar App Mobile
            </Button>
          </motion.div>

          {/* Features highlight */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-4 bg-white/10 rounded-full flex items-center justify-center">
                <Zap className="w-6 h-6 text-yellow-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Setup em 5 minutos</h3>
              <p className="text-brand-100 text-sm">Configure sua propriedade rapidamente</p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-4 bg-white/10 rounded-full flex items-center justify-center">
                <Smartphone className="w-6 h-6 text-green-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Suporte 24/7</h3>
              <p className="text-brand-100 text-sm">WhatsApp sempre disponível</p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-4 bg-white/10 rounded-full flex items-center justify-center">
                <ArrowRight className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Sem Taxas Ocultas</h3>
              <p className="text-brand-100 text-sm">Transparência total nos custos</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.6 }}
            viewport={{ once: true }}
            className="mt-12 text-center"
          >
            <p className="text-brand-200 text-sm">
              * Cadastro gratuito • Sem compromisso • Cancele quando quiser
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
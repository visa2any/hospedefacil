'use client'

import { motion } from 'framer-motion'
import { Facebook, Instagram, Twitter, Youtube, Mail, Phone, MapPin, Crown, Sparkles, Globe, Award } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'

const footerSections = [
  {
    title: 'HospedeFácil',
    links: [
      { label: 'Sobre Nós', href: '/about' },
      { label: 'Como Funciona', href: '/how-it-works' },
      { label: 'Carreiras', href: '/careers' },
      { label: 'Imprensa', href: '/press' },
      { label: 'Blog', href: '/blog' }
    ]
  },
  {
    title: 'Para Hóspedes',
    links: [
      { label: 'Buscar Hospedagem', href: '/search' },
      { label: 'Minhas Viagens', href: '/trips' },
      { label: 'Lista de Desejos', href: '/wishlist' },
      { label: 'Avaliações', href: '/reviews' },
      { label: 'Central de Ajuda', href: '/help' }
    ]
  },
  {
    title: 'Para Hosts',
    links: [
      { label: 'Anuncie sua Propriedade', href: '/host' },
      { label: 'Dashboard do Host', href: '/host/dashboard' },
      { label: 'Recursos', href: '/host/resources' },
      { label: 'Comunidade', href: '/host/community' },
      { label: 'Academy', href: '/host/academy' }
    ]
  },
  {
    title: 'Suporte',
    links: [
      { label: 'Central de Ajuda', href: '/help' },
      { label: 'Contato', href: '/contact' },
      { label: 'WhatsApp', href: `https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER}` },
      { label: 'Status', href: '/status' },
      { label: 'Relatório de Bugs', href: '/bug-report' }
    ]
  }
]

const socialLinks = [
  { icon: Facebook, href: 'https://facebook.com/hospedefacil', label: 'Facebook' },
  { icon: Instagram, href: 'https://instagram.com/hospedefacil', label: 'Instagram' },
  { icon: Twitter, href: 'https://twitter.com/hospedefacil', label: 'Twitter' },
  { icon: Youtube, href: 'https://youtube.com/hospedefacil', label: 'YouTube' }
]

export function Footer() {
  return (
    <footer className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-neutral-900 to-slate-900">
      {/* Premium Background Elements */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-brazilian-gold-500/5 via-transparent to-forest-500/5"></div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-luxury-400/10 via-transparent to-transparent"></div>
      </div>

      {/* Premium Newsletter Section */}
      <div className="relative border-b border-gradient-to-r from-transparent via-neutral-700 to-transparent">
        <div className="container mx-auto px-6 py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center max-w-3xl mx-auto"
          >
            {/* Premium Badge */}
            <div className="inline-flex items-center gap-2 glass-premium rounded-full px-6 py-3 mb-8 border border-brazilian-gold-500/20">
              <Crown className="w-5 h-5 text-brazilian-gold-400" />
              <span className="text-sm font-premium text-white/90 tracking-wide">Newsletter Exclusiva</span>
              <Sparkles className="w-5 h-5 text-brazilian-gold-400" />
            </div>

            <h3 className="font-luxury text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-brazilian-gold-300 via-white to-luxury-300 bg-clip-text text-transparent">
              Experiências Exclusivas Esperando Por Você
            </h3>
            <p className="text-xl text-white/70 mb-8 font-premium leading-relaxed">
              Receba ofertas premium, dicas de viagem de elite e acesso antecipado às melhores propriedades do Brasil
            </p>
            <div className="flex flex-col sm:flex-row gap-4 max-w-lg mx-auto">
              <Input
                type="email"
                placeholder="Seu e-mail VIP"
                variant="glass"
                className="flex-1 font-premium"
                leftIcon={<Mail className="w-5 h-5" />}
              />
              <Button variant="brazilian" size="lg" className="whitespace-nowrap shadow-luxury">
                <Sparkles className="w-5 h-5 mr-2" />
                Juntar-se à Elite
              </Button>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Premium Main Footer Content */}
      <div className="relative container mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12">
          {/* Premium Company Info */}
          <div className="lg:col-span-1">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="space-y-6"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-gradient-premium rounded-2xl flex items-center justify-center shadow-luxury">
                  <span className="text-white font-luxury font-bold text-lg">H</span>
                </div>
                <div>
                  <span className="text-2xl font-luxury font-bold bg-gradient-to-r from-brazilian-gold-400 to-white bg-clip-text text-transparent">HospedeFácil</span>
                  <div className="flex items-center gap-1 mt-1">
                    <Crown className="w-3 h-3 text-brazilian-gold-400" />
                    <span className="text-xs font-premium text-white/60 tracking-wider">PREMIUM PLATFORM</span>
                  </div>
                </div>
              </div>
              
              <p className="text-white/80 text-base font-premium leading-relaxed">
                A plataforma de hospitalidade premium do Brasil. Onde tecnologia de ponta encontra o calor humano brasileiro.
              </p>
              
              {/* Premium Badges */}
              <div className="flex flex-wrap gap-2">
                <div className="inline-flex items-center gap-1 glass-luxury px-3 py-1 rounded-full border border-forest-500/20">
                  <Award className="w-3 h-3 text-forest-400" />
                  <span className="text-xs font-premium text-white/80">Certificado</span>
                </div>
                <div className="inline-flex items-center gap-1 glass-luxury px-3 py-1 rounded-full border border-brazilian-gold-500/20">
                  <Globe className="w-3 h-3 text-brazilian-gold-400" />
                  <span className="text-xs font-premium text-white/80">Internacional</span>
                </div>
              </div>
              
              {/* Premium Contact Info */}
              <div className="space-y-3 pt-4">
                <div className="flex items-center gap-3 text-white/70 hover:text-white transition-colors group">
                  <div className="w-8 h-8 bg-luxury-500/20 rounded-lg flex items-center justify-center group-hover:bg-luxury-500/30 transition-colors">
                    <Mail className="w-4 h-4 text-luxury-400" />
                  </div>
                  <span className="font-premium text-sm">contato@hospedefacil.com.br</span>
                </div>
                <div className="flex items-center gap-3 text-white/70 hover:text-white transition-colors group">
                  <div className="w-8 h-8 bg-forest-500/20 rounded-lg flex items-center justify-center group-hover:bg-forest-500/30 transition-colors">
                    <Phone className="w-4 h-4 text-forest-400" />
                  </div>
                  <span className="font-premium text-sm">0800 123 4567</span>
                </div>
                <div className="flex items-center gap-3 text-white/70 hover:text-white transition-colors group">
                  <div className="w-8 h-8 bg-royal-500/20 rounded-lg flex items-center justify-center group-hover:bg-royal-500/30 transition-colors">
                    <MapPin className="w-4 h-4 text-royal-400" />
                  </div>
                  <span className="font-premium text-sm">São Paulo, SP - Brasil</span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Premium Footer Sections */}
          {footerSections.map((section, sectionIndex) => (
            <div key={section.title}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: sectionIndex * 0.1 }}
                viewport={{ once: true }}
                className="space-y-6"
              >
                <h4 className="text-xl font-luxury font-semibold text-white relative">
                  {section.title}
                  <div className="absolute bottom-0 left-0 w-12 h-0.5 bg-gradient-to-r from-brazilian-gold-400 to-luxury-400 mt-2"></div>
                </h4>
                <ul className="space-y-4">
                  {section.links.map((link, linkIndex) => (
                    <li key={link.href}>
                      <motion.a
                        href={link.href}
                        className="text-white/70 hover:text-white transition-all duration-300 text-sm font-premium flex items-center gap-2 hover:translate-x-1 group"
                        whileHover={{ x: 4 }}
                        transition={{ type: "spring", stiffness: 300 }}
                      >
                        <div className="w-1 h-1 rounded-full bg-brazilian-gold-400 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        {link.label}
                      </motion.a>
                    </li>
                  ))}
                </ul>
              </motion.div>
            </div>
          ))}
        </div>
      </div>

      {/* Premium Bottom Footer */}
      <div className="relative border-t border-gradient-to-r from-transparent via-neutral-700/50 to-transparent">
        {/* Premium Background Glow */}
        <div className="absolute inset-0 bg-gradient-to-t from-brazilian-gold-500/5 to-transparent"></div>
        
        <div className="relative container mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="flex flex-wrap items-center gap-8 text-sm text-white/70"
            >
              <span className="font-premium">
                © 2024 HospedeFácil. Todos os direitos reservados.
              </span>
              <div className="flex items-center gap-6">
                <a href="/privacy" className="hover:text-white transition-colors font-premium hover:underline underline-offset-4">
                  Privacidade
                </a>
                <a href="/terms" className="hover:text-white transition-colors font-premium hover:underline underline-offset-4">
                  Termos
                </a>
                <a href="/cookies" className="hover:text-white transition-colors font-premium hover:underline underline-offset-4">
                  Cookies
                </a>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              viewport={{ once: true }}
              className="flex items-center gap-4"
            >
              {socialLinks.map((social, index) => (
                <motion.a
                  key={social.href}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 bg-gradient-to-br from-neutral-800 to-neutral-900 hover:from-brazilian-gold-500 hover:to-luxury-500 rounded-xl flex items-center justify-center transition-all duration-300 shadow-lg hover:shadow-luxury hover:scale-110"
                  aria-label={social.label}
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <social.icon className="w-5 h-5 text-white" />
                </motion.a>
              ))}
            </motion.div>
          </div>
        </div>
      </div>
    </footer>
  )
}
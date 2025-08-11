'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Menu, X, User, Heart, Bell, Search, Phone, Shield, MessageCircle } from 'lucide-react'
import { Button } from '../ui/button'

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const navItems = [
    { label: 'Buscar', href: '/search', priority: 'high' },
    { label: 'Para Hosts', href: '/host', priority: 'medium' },
    { label: 'Como Funciona', href: '/how-it-works', priority: 'low' },
    { label: 'Ajuda', href: '/help', priority: 'low' }
  ]

  return (
    <>
      {/* Trust Bar - Above header */}
      <div className="bg-forest-500 text-white py-2 text-center text-sm font-medium">
        <div className="container mx-auto px-4 flex items-center justify-center gap-4">
          <div className="flex items-center gap-1">
            <Shield className="w-4 h-4" />
            <span>PIX Instantâneo • Suporte 24/7 • 100% Seguro</span>
          </div>
          <div className="hidden md:flex items-center gap-1">
            <Phone className="w-4 h-4" />
            <span>0800 123 4567</span>
          </div>
        </div>
      </div>

      <header className="sticky top-0 z-50 bg-white border-b border-neutral-200 shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="flex items-center gap-3"
            >
              <div className="w-10 h-10 bg-gradient-to-br from-brand-500 to-forest-500 rounded-xl flex items-center justify-center shadow-sm">
                <span className="text-white font-bold text-lg">H</span>
              </div>
              <div>
                <span className="text-xl font-heading font-bold text-neutral-900">HospedeFácil</span>
                <div className="text-xs text-neutral-500 font-ui font-medium">Brasil</div>
              </div>
            </motion.div>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-8">
              {navItems.map((item, index) => (
                <motion.a
                  key={item.href}
                  href={item.href}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  className={`font-ui font-medium transition-colors hover:text-brand-600 ${
                    item.priority === 'high' 
                      ? 'text-neutral-900' 
                      : 'text-neutral-600'
                  }`}
                >
                  {item.label}
                </motion.a>
              ))}
            </nav>

            {/* Desktop Actions */}
            <div className="hidden lg:flex items-center gap-3">
              {/* WhatsApp Support */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER}?text=Olá! Preciso de ajuda.`, '_blank')}
                className="text-green-600 hover:text-green-700 hover:bg-green-50"
              >
                <MessageCircle className="w-5 h-5" />
              </Button>

              {/* User Menu */}
              <div className="flex items-center gap-2 border-l border-neutral-200 pl-3">
                <Button variant="ghost" size="sm" className="p-2">
                  <Heart className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="sm" className="p-2">
                  <User className="w-5 h-5" />
                </Button>
              </div>

              {/* Primary CTA */}
              <Button className="bg-brand-500 hover:bg-brand-600 text-white font-ui font-semibold px-6 rounded-xl">
                Anuncie Grátis
              </Button>
            </div>

            {/* Mobile Menu Button */}
            <div className="lg:hidden">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-2"
              >
                {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </Button>
            </div>
          </div>

          {/* Mobile Navigation */}
          <motion.div
            initial={false}
            animate={{ 
              height: isMenuOpen ? 'auto' : 0,
              opacity: isMenuOpen ? 1 : 0
            }}
            transition={{ duration: 0.3 }}
            className="lg:hidden overflow-hidden"
          >
            <nav className="py-6 space-y-6 border-t border-neutral-200">
              {navItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="block text-lg font-medium text-neutral-700 hover:text-brand-600 transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.label}
                </a>
              ))}
              
              {/* Mobile Support */}
              <div className="border-t border-neutral-200 pt-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-medium text-neutral-900">Precisa de ajuda?</span>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <Button
                    variant="outline"
                    onClick={() => window.open(`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER}`, '_blank')}
                    className="flex items-center gap-2 justify-center border-green-300 text-green-600 hover:bg-green-50"
                  >
                    <MessageCircle className="w-4 h-4" />
                    WhatsApp
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => window.open('tel:08001234567', '_self')}
                    className="flex items-center gap-2 justify-center"
                  >
                    <Phone className="w-4 h-4" />
                    Ligar
                  </Button>
                </div>
              </div>

              {/* Mobile CTAs */}
              <div className="space-y-3">
                <Button variant="outline" className="w-full">
                  Entrar / Cadastrar
                </Button>
                <Button className="w-full bg-brand-500 hover:bg-brand-600 text-white font-semibold">
                  Anuncie sua Propriedade
                </Button>
              </div>
            </nav>
          </motion.div>
        </div>
      </header>
    </>
  )
}
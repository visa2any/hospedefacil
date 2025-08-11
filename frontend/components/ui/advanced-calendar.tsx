'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Calendar, MapPin, TrendingUp, Clock, Star } from 'lucide-react'
import { Button } from './button'

interface DateRange {
  startDate: Date | null
  endDate: Date | null
}

interface CalendarProps {
  onDateSelect: (dateRange: DateRange) => void
  className?: string
}

// Simulated price data - deterministic to avoid SSR/hydration issues
const getPriceForDate = (date: Date) => {
  const basePrice = 150
  const dayOfWeek = date.getDay()
  const isWeekend = dayOfWeek === 5 || dayOfWeek === 6
  const seasonMultiplier = Math.sin((date.getMonth() * Math.PI) / 6) * 0.3 + 1
  // Use date-based deterministic variation instead of Math.random()
  const daysSinceEpoch = Math.floor(date.getTime() / (1000 * 60 * 60 * 24))
  const deterministicVariation = (Math.sin(daysSinceEpoch * 0.1) * 0.4)
  
  return Math.round(basePrice * (isWeekend ? 1.4 : 1) * seasonMultiplier * (1 + deterministicVariation))
}

const getAvailabilityForDate = (date: Date) => {
  // Simulate some unavailable dates
  const unavailableDates = [3, 7, 14, 21, 28] // Days of month that are unavailable
  const day = date.getDate()
  const isUnavailable = unavailableDates.includes(day)
  
  if (isUnavailable) return { available: false, roomsLeft: 0 }
  
  // Use deterministic room count based on date instead of Math.random()
  const daysSinceEpoch = Math.floor(date.getTime() / (1000 * 60 * 60 * 24))
  const roomsLeft = Math.floor(Math.abs(Math.sin(daysSinceEpoch * 0.13)) * 7) + 1
  return { available: true, roomsLeft }
}

export function AdvancedCalendar({ onDateSelect, className = "" }: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedRange, setSelectedRange] = useState<DateRange>({ startDate: null, endDate: null })
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null)
  const [isSelecting, setIsSelecting] = useState(false)

  const today = new Date()
  const maxDate = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate())

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ]

  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    const days = []

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null)
    }

    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day))
    }

    return days
  }

  const isDateInRange = (date: Date) => {
    if (!selectedRange.startDate || !selectedRange.endDate) return false
    return date >= selectedRange.startDate && date <= selectedRange.endDate
  }

  const isDateHovered = (date: Date) => {
    if (!selectedRange.startDate || selectedRange.endDate || !hoveredDate) return false
    const start = selectedRange.startDate
    const end = hoveredDate
    if (start <= end) {
      return date >= start && date <= end
    } else {
      return date >= end && date <= start
    }
  }

  const handleDateClick = (date: Date) => {
    const availability = getAvailabilityForDate(date)
    if (!availability.available) return

    if (!selectedRange.startDate) {
      // First selection
      setSelectedRange({ startDate: date, endDate: null })
      setIsSelecting(true)
    } else if (!selectedRange.endDate) {
      // Second selection
      const startDate = selectedRange.startDate
      const endDate = date >= startDate ? date : startDate
      const newStartDate = date >= startDate ? startDate : date
      
      const newRange = { startDate: newStartDate, endDate }
      setSelectedRange(newRange)
      setIsSelecting(false)
      onDateSelect(newRange)
    } else {
      // Start over
      setSelectedRange({ startDate: date, endDate: null })
      setIsSelecting(true)
    }
  }

  const isDateDisabled = (date: Date) => {
    return date < today || !getAvailabilityForDate(date).available
  }

  const isDateSelected = (date: Date) => {
    return (selectedRange.startDate && date.getTime() === selectedRange.startDate.getTime()) ||
           (selectedRange.endDate && date.getTime() === selectedRange.endDate.getTime())
  }

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }

  const prevMonth = () => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
    if (newDate >= new Date(today.getFullYear(), today.getMonth(), 1)) {
      setCurrentDate(newDate)
    }
  }

  const calculateTotalPrice = () => {
    if (!selectedRange.startDate || !selectedRange.endDate) return 0
    
    let total = 0
    const current = new Date(selectedRange.startDate)
    const end = new Date(selectedRange.endDate)
    
    while (current < end) {
      total += getPriceForDate(current)
      current.setDate(current.getDate() + 1)
    }
    
    return total
  }

  const getDaysBetween = () => {
    if (!selectedRange.startDate || !selectedRange.endDate) return 0
    const diffTime = Math.abs(selectedRange.endDate.getTime() - selectedRange.startDate.getTime())
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  const days = getDaysInMonth(currentDate)

  return (
    <div className={`bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-6 bg-gradient-to-r from-blue-50 to-purple-50 border-b border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Calendar className="w-6 h-6 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              {isSelecting ? 'Escolha a data de saída' : 'Selecione suas datas'}
            </h3>
          </div>
          
          {selectedRange.startDate && selectedRange.endDate && (
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-600">
                R$ {calculateTotalPrice().toLocaleString('pt-BR')}
              </div>
              <div className="text-sm text-gray-600">
                {getDaysBetween()} {getDaysBetween() === 1 ? 'diária' : 'diárias'}
              </div>
            </div>
          )}
        </div>

        {/* Current Selection Display */}
        {(selectedRange.startDate || selectedRange.endDate) && (
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg shadow-sm">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span className="font-medium">
                Check-in: {selectedRange.startDate?.toLocaleDateString('pt-BR') || '—'}
              </span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg shadow-sm">
              <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
              <span className="font-medium">
                Check-out: {selectedRange.endDate?.toLocaleDateString('pt-BR') || '—'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Calendar Navigation */}
      <div className="flex items-center justify-between p-4 bg-gray-50 border-b border-gray-100">
        <Button
          variant="ghost"
          size="sm"
          onClick={prevMonth}
          disabled={currentDate <= new Date(today.getFullYear(), today.getMonth(), 1)}
          className="p-2 h-10 w-10 rounded-full hover:bg-white hover:shadow-md transition-all duration-200"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        
        <h4 className="text-lg font-semibold text-gray-900">
          {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
        </h4>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={nextMonth}
          disabled={currentDate >= new Date(maxDate.getFullYear(), maxDate.getMonth(), 1)}
          className="p-2 h-10 w-10 rounded-full hover:bg-white hover:shadow-md transition-all duration-200"
        >
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      {/* Calendar Grid */}
      <div className="p-6">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-4">
          {dayNames.map((day) => (
            <div key={day} className="p-3 text-center text-sm font-medium text-gray-500">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7 gap-1">
          <AnimatePresence>
            {days.map((date, index) => {
              if (!date) {
                return <div key={index} className="p-3" />
              }

              const price = getPriceForDate(date)
              const availability = getAvailabilityForDate(date)
              const isDisabled = isDateDisabled(date)
              const isSelected = isDateSelected(date)
              const inRange = isDateInRange(date)
              const isHovered = isDateHovered(date)
              const isToday = date.toDateString() === today.toDateString()

              return (
                <motion.div
                  key={date.toISOString()}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.2, delay: index * 0.01 }}
                  className={`
                    relative p-2 rounded-xl cursor-pointer transition-all duration-200 group
                    ${isDisabled 
                      ? 'opacity-40 cursor-not-allowed' 
                      : 'hover:bg-blue-50 hover:scale-105 hover:shadow-md'
                    }
                    ${isSelected 
                      ? 'bg-blue-500 text-white shadow-lg scale-105' 
                      : ''
                    }
                    ${inRange && !isSelected 
                      ? 'bg-blue-100 text-blue-800' 
                      : ''
                    }
                    ${isHovered && !inRange && !isSelected 
                      ? 'bg-blue-50 text-blue-700' 
                      : ''
                    }
                    ${isToday && !isSelected 
                      ? 'ring-2 ring-blue-400 ring-opacity-50' 
                      : ''
                    }
                  `}
                  onClick={() => !isDisabled && handleDateClick(date)}
                  onMouseEnter={() => !isDisabled && setHoveredDate(date)}
                  onMouseLeave={() => setHoveredDate(null)}
                  whileHover={!isDisabled ? { scale: 1.05 } : {}}
                  whileTap={!isDisabled ? { scale: 0.95 } : {}}
                >
                  <div className="text-center">
                    {/* Date number */}
                    <div className={`text-lg font-semibold mb-1 ${
                      isSelected ? 'text-white' : 
                      isDisabled ? 'text-gray-400' : 'text-gray-900'
                    }`}>
                      {date.getDate()}
                    </div>
                    
                    {/* Price */}
                    {!isDisabled && (
                      <div className={`text-xs font-medium ${
                        isSelected ? 'text-white' : 
                        inRange ? 'text-blue-700' : 'text-gray-600'
                      }`}>
                        R$ {price}
                      </div>
                    )}

                    {/* Availability indicator */}
                    {!isDisabled && availability.roomsLeft <= 3 && (
                      <div className="absolute -top-1 -right-1">
                        <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></div>
                      </div>
                    )}

                    {/* Low availability warning */}
                    {!isDisabled && availability.roomsLeft <= 2 && (
                      <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <div className="bg-orange-500 text-white text-xs px-2 py-1 rounded-full whitespace-nowrap">
                          Só {availability.roomsLeft} disponível{availability.roomsLeft === 1 ? '' : 'is'}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* Footer with quick actions */}
      <div className="p-6 bg-gray-50 border-t border-gray-100">
        <div className="flex flex-wrap gap-3 justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const tomorrow = new Date(today)
              tomorrow.setDate(tomorrow.getDate() + 1)
              const dayAfter = new Date(tomorrow)
              dayAfter.setDate(dayAfter.getDate() + 2)
              const range = { startDate: tomorrow, endDate: dayAfter }
              setSelectedRange(range)
              onDateSelect(range)
            }}
            className="text-sm px-4 py-2 rounded-lg hover:bg-blue-50 hover:text-blue-700 transition-colors duration-200"
          >
            🏃‍♂️ Fim de semana (2 dias)
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const tomorrow = new Date(today)
              tomorrow.setDate(tomorrow.getDate() + 1)
              const weekLater = new Date(tomorrow)
              weekLater.setDate(weekLater.getDate() + 7)
              const range = { startDate: tomorrow, endDate: weekLater }
              setSelectedRange(range)
              onDateSelect(range)
            }}
            className="text-sm px-4 py-2 rounded-lg hover:bg-blue-50 hover:text-blue-700 transition-colors duration-200"
          >
            📅 Semana (7 dias)
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSelectedRange({ startDate: null, endDate: null })
              setIsSelecting(false)
              onDateSelect({ startDate: null, endDate: null })
            }}
            className="text-sm px-4 py-2 rounded-lg hover:bg-red-50 hover:text-red-700 transition-colors duration-200"
          >
            🗑️ Limpar
          </Button>
        </div>

        {/* Price breakdown */}
        {selectedRange.startDate && selectedRange.endDate && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-6 p-4 bg-white rounded-xl shadow-sm border border-gray-200"
          >
            <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
              Resumo da Reserva
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">
                  {getDaysBetween()} {getDaysBetween() === 1 ? 'diária' : 'diárias'}
                </span>
                <span className="font-medium">R$ {calculateTotalPrice().toLocaleString('pt-BR')}</span>
              </div>
              <div className="flex justify-between text-green-600">
                <span>Sem taxas de limpeza</span>
                <span>R$ 0</span>
              </div>
              <div className="flex justify-between text-green-600">
                <span>Sem taxas de serviço</span>
                <span>R$ 0</span>
              </div>
              <hr className="my-2" />
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span className="text-blue-600">R$ {calculateTotalPrice().toLocaleString('pt-BR')}</span>
              </div>
              <div className="text-xs text-gray-500 mt-2">
                💳 Pague com PIX e ganhe 3% de cashback
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
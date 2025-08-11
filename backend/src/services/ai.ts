import OpenAI from 'openai'
import { config } from '@/config/environment.js'
import { prisma } from '@/config/database.js'

interface PropertyData {
  title: string
  type: string
  bedrooms: number
  bathrooms: number
  maxGuests: number
  neighborhood: string
  city: string
  amenities: string[]
  description?: string
}

interface SearchQuery {
  query: string
  location?: string
  checkIn?: Date
  checkOut?: Date
  guests?: number
  priceRange?: { min: number, max: number }
}

interface UserContext {
  id: string
  name: string
  email: string
  role: 'GUEST' | 'HOST' | 'ADMIN'
}

export class AIService {
  private openai: OpenAI
  private isReady: boolean

  constructor() {
    if (!config.OPENAI_API_KEY) {
      console.error('❌ OpenAI API Key não configurada')
      this.isReady = false
    } else {
      this.openai = new OpenAI({
        apiKey: config.OPENAI_API_KEY
      })
      this.isReady = true
      console.log('✅ AI Service configurado e pronto!')
    }
  }

  // Generate enhanced property description
  async generatePropertyDescription(propertyData: PropertyData): Promise<string | null> {
    if (!this.isReady) return null

    try {
      const prompt = `Como especialista em marketing imobiliário brasileiro, crie uma descrição atrativa para esta propriedade:

Título: ${propertyData.title}
Tipo: ${propertyData.type}
Localização: ${propertyData.neighborhood}, ${propertyData.city}
Quartos: ${propertyData.bedrooms}
Banheiros: ${propertyData.bathrooms}
Capacidade: ${propertyData.maxGuests} hóspedes
Comodidades: ${propertyData.amenities.join(', ')}
${propertyData.description ? `Descrição atual: ${propertyData.description}` : ''}

Requisitos:
- Máximo 300 palavras
- Tom acolhedor e profissional
- Destacar pontos únicos da propriedade
- Mencionar comodidades relevantes
- Incluir informações sobre a localização
- Usar português brasileiro natural
- Não usar emojis excessivos
- Focar em experiências que o hóspede terá

Crie uma descrição que faça o hóspede se imaginar hospedado lá:`

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'Você é um especialista em marketing imobiliário brasileiro, criando descrições irresistíveis para propriedades de hospedagem. Seja criativo, acolhedor e persuasivo.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 400,
        temperature: 0.7
      })

      return response.choices[0]?.message?.content?.trim() || null

    } catch (error) {
      console.error('Erro ao gerar descrição da propriedade:', error)
      return null
    }
  }

  // Generate WhatsApp response
  async generateWhatsAppResponse(message: string, phoneNumber: string, user: UserContext | null): Promise<string | null> {
    if (!this.isReady) return null

    try {
      // Get conversation history
      const recentMessages = await prisma.chatMessage.findMany({
        where: {
          sessionId: `whatsapp:${phoneNumber}`
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      })

      const conversationHistory = recentMessages
        .reverse()
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n')

      const systemPrompt = `Você é o assistente virtual do HospedeFácil, a plataforma de hospedagem mais avançada do Brasil.

PERSONALIDADE:
- Amigável, profissional e prestativo
- Usa português brasileiro natural
- Eficiente e objetivo
- Conhece profundamente o mercado brasileiro de hospedagem

CAPACIDADES:
- Buscar propriedades por localização, datas, número de hóspedes
- Explicar o processo de reserva e pagamento PIX
- Ajudar com dúvidas sobre check-in/check-out
- Fornecer informações sobre políticas de cancelamento
- Conectar com suporte humano quando necessário

COMANDOS ESPECIAIS:
- #buscar [cidade] - Buscar propriedades
- #reservas - Ver reservas do usuário
- #ajuda - Lista de comandos
- #suporte - Conectar com atendente humano

CONTEXTO DO USUÁRIO:
${user ? `
Nome: ${user.name}
Email: ${user.email}
Tipo: ${user.role === 'HOST' ? 'Anfitrião' : user.role === 'GUEST' ? 'Hóspede' : 'Admin'}
` : 'Usuário não identificado'}

HISTÓRICO RECENTE:
${conversationHistory}

INSTRUÇÕES:
1. Responda sempre em português brasileiro
2. Seja conciso mas completo
3. Use emojis moderadamente
4. Se não souber algo, seja honesto e ofereça conectar com suporte
5. Para buscas de propriedades, peça informações específicas (cidade, datas, hóspedes)
6. Sempre promova os benefícios do HospedeFácil: PIX instantâneo, 3 cliques, suporte via WhatsApp
7. Máximo 200 palavras por resposta

DIFERENCIAIS DO HOSPEDEFÁCIL:
- Pagamento PIX instantâneo (vs 2-3 dias Airbnb)  
- Reserva em 3 cliques (vs 15+ Airbnb)
- Suporte 24/7 via WhatsApp
- Plataforma 100% brasileira
- Comissão baixa (10% vs 15% concorrentes)
- IA em português para melhor experiência`

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: message
          }
        ],
        max_tokens: 300,
        temperature: 0.7
      })

      const aiResponse = response.choices[0]?.message?.content?.trim()

      // Log AI response
      if (aiResponse) {
        await prisma.chatMessage.create({
          data: {
            sessionId: `whatsapp:${phoneNumber}`,
            userId: user?.id || null,
            role: 'assistant',
            content: aiResponse,
            metadata: {
              platform: 'whatsapp',
              model: 'gpt-4',
              phoneNumber
            }
          }
        })
      }

      return aiResponse || null

    } catch (error) {
      console.error('Erro ao gerar resposta WhatsApp:', error)
      return this.getFallbackResponse(message)
    }
  }

  // Process natural language search
  async processNaturalLanguageSearch(query: SearchQuery): Promise<any> {
    if (!this.isReady) return null

    try {
      const prompt = `Como especialista em busca de hospedagem, extraia informações desta consulta em português:

"${query.query}"

Identifique:
- Localização (cidade, bairro, região)
- Tipo de propriedade (casa, apartamento, etc.)
- Número de hóspedes
- Datas aproximadas
- Características especiais (piscina, praia, centro, etc.)
- Faixa de preço
- Ocasião/motivo da viagem

Retorne em JSON com as chaves: location, propertyType, guests, checkIn, checkOut, amenities, priceRange, occasion, originalQuery`

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'Você é um especialista em interpretar pedidos de hospedagem em português brasileiro. Retorne apenas JSON válido.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 300,
        temperature: 0.3
      })

      const jsonResponse = response.choices[0]?.message?.content?.trim()
      if (!jsonResponse) return null

      try {
        return JSON.parse(jsonResponse)
      } catch {
        return null
      }

    } catch (error) {
      console.error('Erro ao processar busca em linguagem natural:', error)
      return null
    }
  }

  // Generate property search results summary
  async generateSearchSummary(properties: any[], searchParams: any): Promise<string | null> {
    if (!this.isReady) return null

    try {
      const prompt = `Crie um resumo atrativo para estes resultados de busca:

Parâmetros da busca:
Localização: ${searchParams.city || 'Não especificada'}
Hóspedes: ${searchParams.guests || 'Não especificado'}
Datas: ${searchParams.checkIn || 'Flexíveis'}

Propriedades encontradas: ${properties.length}
${properties.slice(0, 3).map(p => `- ${p.title} em ${p.city} - R$ ${p.basePrice}/noite`).join('\n')}

Crie um resumo em 1-2 frases destacando:
- Quantidade de opções encontradas
- Variedade de preços
- Localizações disponíveis
- Convite à ação

Tom: Entusiasmado mas informativo, em português brasileiro.`

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'Você cria resumos empolgantes para resultados de busca de hospedagem.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 150,
        temperature: 0.7
      })

      return response.choices[0]?.message?.content?.trim() || null

    } catch (error) {
      console.error('Erro ao gerar resumo de busca:', error)
      return null
    }
  }

  // Generate review analysis
  async analyzeReview(reviewText: string): Promise<{ sentiment: string, tags: string[], score: number } | null> {
    if (!this.isReady) return null

    try {
      const prompt = `Analise esta avaliação de hospedagem em português:

"${reviewText}"

Determine:
1. Sentimento: positivo, negativo ou neutro
2. Pontuação de 1-5 baseada no sentimento
3. Tags relevantes (máximo 5): limpeza, localização, anfitrião, valor, conforto, etc.

Retorne JSON: {"sentiment": "positivo/negativo/neutro", "score": 1-5, "tags": ["tag1", "tag2"]}`

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'Você analisa avaliações de hospedagem em português brasileiro com precisão.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 200,
        temperature: 0.3
      })

      const jsonResponse = response.choices[0]?.message?.content?.trim()
      if (!jsonResponse) return null

      try {
        return JSON.parse(jsonResponse)
      } catch {
        return null
      }

    } catch (error) {
      console.error('Erro ao analisar avaliação:', error)
      return null
    }
  }

  // Generate pricing recommendations
  async generatePricingRecommendation(propertyData: any, marketData: any): Promise<string | null> {
    if (!this.isReady) return null

    try {
      const prompt = `Como consultor de pricing para hospedagem, analise:

PROPRIEDADE:
Localização: ${propertyData.city}, ${propertyData.neighborhood}
Tipo: ${propertyData.type}
Quartos: ${propertyData.bedrooms}
Capacidade: ${propertyData.maxGuests}
Preço atual: R$ ${propertyData.basePrice}
Taxa de ocupação: ${propertyData.occupancyRate || 'N/A'}%

DADOS DE MERCADO:
Preço médio da região: R$ ${marketData.averagePrice || 'N/A'}
Taxa de ocupação média: ${marketData.occupancyRate || 'N/A'}%
Eventos próximos: ${marketData.events?.join(', ') || 'Nenhum'}
Demanda atual: ${marketData.demandScore || 'N/A'}/10

Forneça:
1. Recomendação de preço (aumentar/manter/diminuir)
2. Justificativa baseada em dados
3. Estratégia para próximos 30 dias
4. Dicas específicas

Resposta em português, máximo 150 palavras, tom profissional mas acessível.`

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'Você é um consultor especializado em precificação de hospedagem no Brasil.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 200,
        temperature: 0.6
      })

      return response.choices[0]?.message?.content?.trim() || null

    } catch (error) {
      console.error('Erro ao gerar recomendação de preço:', error)
      return null
    }
  }

  // Generate customer support response
  async generateSupportResponse(issue: string, context: any): Promise<string | null> {
    if (!this.isReady) return null

    try {
      const prompt = `Como especialista em atendimento ao cliente do HospedeFácil, responda a esta questão:

PROBLEMA: ${issue}

CONTEXTO:
${context.user ? `Usuário: ${context.user.name} (${context.user.role})` : 'Usuário anônimo'}
${context.booking ? `Reserva: ${context.booking.id} - ${context.booking.property.title}` : 'Sem reserva específica'}
${context.property ? `Propriedade: ${context.property.title} em ${context.property.city}` : ''}

DIRETRIZES:
1. Seja empático e profissional
2. Ofereça soluções práticas
3. Use português brasileiro natural
4. Se necessário, direcione para suporte especializado
5. Mencione diferenciais do HospedeFácil quando relevante
6. Máximo 100 palavras

Responda de forma completa mas concisa:`

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'Você é um especialista em atendimento ao cliente, sempre prestativo e solucionador de problemas.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 150,
        temperature: 0.7
      })

      return response.choices[0]?.message?.content?.trim() || null

    } catch (error) {
      console.error('Erro ao gerar resposta de suporte:', error)
      return null
    }
  }

  // Detect intent from message
  async detectIntent(message: string): Promise<{ intent: string, confidence: number, entities: any } | null> {
    if (!this.isReady) return null

    try {
      const prompt = `Analise esta mensagem de usuário e identifique a intenção:

"${message}"

Possíveis intenções:
- search_property (buscar propriedade)
- make_booking (fazer reserva)
- check_booking (verificar reserva)
- cancel_booking (cancelar reserva)
- payment_help (ajuda com pagamento)
- general_info (informações gerais)
- complaint (reclamação)
- compliment (elogio)
- support_request (solicitar suporte)

Retorne JSON: {"intent": "intent_name", "confidence": 0.0-1.0, "entities": {"location": "cidade", "dates": "datas", "guests": "número"}}`

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'Você detecta intenções em mensagens de usuários de plataforma de hospedagem.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 200,
        temperature: 0.2
      })

      const jsonResponse = response.choices[0]?.message?.content?.trim()
      if (!jsonResponse) return null

      try {
        return JSON.parse(jsonResponse)
      } catch {
        return null
      }

    } catch (error) {
      console.error('Erro ao detectar intenção:', error)
      return null
    }
  }

  // Get AI service status
  getStatus(): { isReady: boolean, model: string, features: string[] } {
    return {
      isReady: this.isReady,
      model: 'GPT-4',
      features: [
        'Property descriptions',
        'WhatsApp responses',
        'Natural language search',
        'Review analysis',
        'Pricing recommendations',
        'Customer support',
        'Intent detection'
      ]
    }
  }

  // Fallback response when AI is not available
  private getFallbackResponse(message: string): string {
    const lowerMessage = message.toLowerCase()
    
    if (lowerMessage.includes('buscar') || lowerMessage.includes('procurar')) {
      return `🔍 Para buscar propriedades, me informe:
• Cidade ou região
• Datas da estadia
• Número de hóspedes

Exemplo: "Quero uma casa em Florianópolis para 4 pessoas no final de semana"`
    }
    
    if (lowerMessage.includes('reserva')) {
      return `📅 Para consultar suas reservas, digite *#reservas*

Para fazer uma nova reserva:
1. Busque a propriedade
2. Escolha as datas
3. Confirme com PIX

💬 Precisa de ajuda? Digite *#suporte*`
    }
    
    if (lowerMessage.includes('ajuda') || lowerMessage.includes('help')) {
      return `📋 *Comandos disponíveis:*

🔍 *#buscar [cidade]* - Encontrar propriedades
📅 *#reservas* - Ver suas reservas
❓ *#ajuda* - Esta mensagem
🆘 *#suporte* - Falar com atendente

💬 Ou apenas descreva o que precisa que eu te ajudo!`
    }
    
    return `Olá! 👋 Sou o assistente do HospedeFácil.

🏠 Posso te ajudar a:
• Buscar propriedades
• Fazer reservas
• Tirar dúvidas sobre hospedagem

💬 Me conte o que você precisa ou digite *#ajuda* para ver todos os comandos.`
  }
}
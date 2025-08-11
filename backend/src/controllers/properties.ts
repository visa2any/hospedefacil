import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { prisma } from '@/config/database.js'
import { cacheService } from '@/config/redis.js'
import { CloudinaryService } from '@/services/cloudinary.js'
import { GeocodeService } from '@/services/geocode.js'
import { AIService } from '@/services/ai.js'
import { business } from '@/config/environment.js'

// Validation schemas
const createPropertySchema = z.object({
  title: z.string().min(10, 'Título deve ter pelo menos 10 caracteres').max(100),
  description: z.string().min(50, 'Descrição deve ter pelo menos 50 caracteres').max(2000),
  type: z.enum(['APARTMENT', 'HOUSE', 'CONDO', 'LOFT', 'STUDIO', 'FARM', 'CHALET', 'BOAT', 'OTHER']),
  
  // Location
  street: z.string().min(5, 'Rua é obrigatória'),
  number: z.string().optional(),
  complement: z.string().optional(),
  neighborhood: z.string().min(2, 'Bairro é obrigatório'),
  city: z.string().min(2, 'Cidade é obrigatória'),
  state: z.string().length(2, 'Estado deve ter 2 caracteres'),
  zipCode: z.string().regex(/^\d{5}-?\d{3}$/, 'CEP inválido'),
  
  // Property details
  bedrooms: z.number().int().min(0).max(20),
  bathrooms: z.number().int().min(1).max(20),
  beds: z.number().int().min(1).max(50),
  maxGuests: z.number().int().min(1).max(50),
  area: z.number().positive().optional(),
  
  // Pricing
  basePrice: z.number().positive('Preço deve ser positivo'),
  cleaningFee: z.number().min(0).default(0),
  
  // Rules
  checkInTime: z.string().regex(/^\d{2}:\d{2}$/, 'Horário inválido'),
  checkOutTime: z.string().regex(/^\d{2}:\d{2}$/, 'Horário inválido'),
  minStay: z.number().int().min(1).max(365),
  maxStay: z.number().int().min(1).max(365),
  
  // House rules
  smokingAllowed: z.boolean().default(false),
  petsAllowed: z.boolean().default(false),
  partiesAllowed: z.boolean().default(false),
  
  // Amenities
  amenities: z.array(z.string()).default([]),
})

const updatePropertySchema = createPropertySchema.partial()

const propertyQuerySchema = z.object({
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('10'),
  status: z.enum(['DRAFT', 'ACTIVE', 'INACTIVE', 'SUSPENDED', 'UNDER_REVIEW']).optional(),
  type: z.enum(['APARTMENT', 'HOUSE', 'CONDO', 'LOFT', 'STUDIO', 'FARM', 'CHALET', 'BOAT', 'OTHER']).optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  minPrice: z.string().transform(Number).optional(),
  maxPrice: z.string().transform(Number).optional(),
  bedrooms: z.string().transform(Number).optional(),
  maxGuests: z.string().transform(Number).optional(),
  sort: z.enum(['newest', 'oldest', 'price-asc', 'price-desc', 'rating']).default('newest'),
})

export class PropertyController {
  private cloudinaryService = new CloudinaryService()
  private geocodeService = new GeocodeService()
  private aiService = new AIService()

  // Create property
  async createProperty(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = createPropertySchema.parse(request.body)
      const hostId = request.user!.id

      // Verify host permissions
      const hostProfile = await prisma.hostProfile.findUnique({
        where: { userId: hostId }
      })

      if (!hostProfile) {
        return reply.status(403).send({
          error: 'Perfil de anfitrião necessário',
          message: 'Você precisa completar seu perfil de anfitrião para criar propriedades.'
        })
      }

      // Geocode address
      const fullAddress = `${body.street}, ${body.number || ''}, ${body.neighborhood}, ${body.city}, ${body.state}, ${body.zipCode}, Brasil`
      const geocodeResult = await this.geocodeService.geocode(fullAddress)

      if (!geocodeResult) {
        return reply.status(400).send({
          error: 'Endereço inválido',
          message: 'Não foi possível localizar o endereço informado.'
        })
      }

      // Generate AI description if not provided or enhance existing one
      let enhancedDescription = body.description
      try {
        const aiDescription = await this.aiService.generatePropertyDescription({
          title: body.title,
          type: body.type,
          bedrooms: body.bedrooms,
          bathrooms: body.bathrooms,
          maxGuests: body.maxGuests,
          neighborhood: body.neighborhood,
          city: body.city,
          amenities: body.amenities,
          description: body.description
        })
        
        if (aiDescription) {
          enhancedDescription = aiDescription
        }
      } catch (error) {
        request.log.warn('AI description generation failed:', error)
      }

      // Generate SEO-friendly slug
      const slug = this.generateSlug(body.title, body.city)

      // Check if slug already exists
      const existingProperty = await prisma.property.findUnique({
        where: { slug }
      })

      const finalSlug = existingProperty ? `${slug}-${Date.now()}` : slug

      // Create property
      const property = await prisma.property.create({
        data: {
          hostId,
          title: body.title,
          description: enhancedDescription,
          aiDescription: enhancedDescription !== body.description ? enhancedDescription : null,
          type: body.type,
          status: 'DRAFT',
          
          // Location
          street: body.street,
          number: body.number,
          complement: body.complement,
          neighborhood: body.neighborhood,
          city: body.city,
          state: body.state,
          zipCode: body.zipCode.replace(/\D/g, '').replace(/(\d{5})(\d{3})/, '$1-$2'),
          country: 'BR',
          latitude: geocodeResult.lat,
          longitude: geocodeResult.lng,
          
          // Details
          bedrooms: body.bedrooms,
          bathrooms: body.bathrooms,
          beds: body.beds,
          maxGuests: body.maxGuests,
          area: body.area,
          
          // Pricing
          basePrice: body.basePrice,
          cleaningFee: body.cleaningFee,
          serviceFee: body.basePrice * business.hostFeePercent,
          
          // Rules
          checkInTime: body.checkInTime,
          checkOutTime: body.checkOutTime,
          minStay: body.minStay,
          maxStay: body.maxStay,
          
          smokingAllowed: body.smokingAllowed,
          petsAllowed: body.petsAllowed,
          partiesAllowed: body.partiesAllowed,
          
          slug: finalSlug,
          seoTitle: `${body.title} - ${body.city}, ${body.state} | HospedeFácil`,
          seoDescription: `Alugue ${body.title.toLowerCase()} em ${body.city}, ${body.state}. ${body.bedrooms} quartos, até ${body.maxGuests} hóspedes. A partir de R$ ${body.basePrice.toFixed(2)}/diária.`,
        },
        include: {
          host: {
            select: {
              id: true,
              name: true,
              avatar: true,
              hostProfile: {
                select: {
                  isSuperHost: true,
                  averageRating: true,
                  responseRate: true,
                  responseTime: true,
                }
              }
            }
          }
        }
      })

      // Add amenities if provided
      if (body.amenities.length > 0) {
        const amenities = await prisma.amenity.findMany({
          where: { id: { in: body.amenities } }
        })

        if (amenities.length > 0) {
          await prisma.propertyAmenity.createMany({
            data: amenities.map(amenity => ({
              propertyId: property.id,
              amenityId: amenity.id,
            }))
          })
        }
      }

      // Generate initial availability (next 365 days)
      const availabilityData = []
      const today = new Date()
      
      for (let i = 0; i < 365; i++) {
        const date = new Date(today)
        date.setDate(date.getDate() + i)
        
        availabilityData.push({
          propertyId: property.id,
          date,
          isBlocked: false,
          price: body.basePrice,
        })
      }

      await prisma.propertyAvailability.createMany({
        data: availabilityData
      })

      return reply.status(201).send({
        message: 'Propriedade criada com sucesso!',
        property: {
          ...property,
          amenities: body.amenities,
        }
      })

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Dados inválidos',
          details: error.errors
        })
      }

      request.log.error('Create property error:', error)
      return reply.status(500).send({
        error: 'Erro interno',
        message: 'Não foi possível criar a propriedade.'
      })
    }
  }

  // Get properties (with filters and pagination)
  async getProperties(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = propertyQuerySchema.parse(request.query)
      const cacheKey = `properties:${JSON.stringify(query)}`

      // Try cache first
      const cached = await cacheService.get(cacheKey)
      if (cached) {
        return reply.send(JSON.parse(cached))
      }

      // Build filters
      const where: any = {
        status: query.status || 'ACTIVE',
      }

      if (query.type) where.type = query.type
      if (query.city) where.city = { contains: query.city, mode: 'insensitive' }
      if (query.state) where.state = query.state
      if (query.bedrooms) where.bedrooms = { gte: query.bedrooms }
      if (query.maxGuests) where.maxGuests = { gte: query.maxGuests }
      
      if (query.minPrice || query.maxPrice) {
        where.basePrice = {}
        if (query.minPrice) where.basePrice.gte = query.minPrice
        if (query.maxPrice) where.basePrice.lte = query.maxPrice
      }

      // Build sorting
      let orderBy: any = { createdAt: 'desc' }
      switch (query.sort) {
        case 'oldest':
          orderBy = { createdAt: 'asc' }
          break
        case 'price-asc':
          orderBy = { basePrice: 'asc' }
          break
        case 'price-desc':
          orderBy = { basePrice: 'desc' }
          break
        case 'rating':
          orderBy = { averageRating: 'desc' }
          break
      }

      // Get total count
      const totalCount = await prisma.property.count({ where })

      // Get properties
      const properties = await prisma.property.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          images: {
            orderBy: { order: 'asc' },
            take: 1,
          },
          amenities: {
            include: {
              amenity: true
            }
          },
          host: {
            select: {
              id: true,
              name: true,
              avatar: true,
              hostProfile: {
                select: {
                  isSuperHost: true,
                  averageRating: true,
                }
              }
            }
          },
          _count: {
            select: {
              reviews: true,
            }
          }
        }
      })

      const result = {
        properties: properties.map(property => ({
          ...property,
          amenities: property.amenities.map(pa => pa.amenity),
          reviewCount: property._count.reviews,
        })),
        pagination: {
          page: query.page,
          limit: query.limit,
          total: totalCount,
          pages: Math.ceil(totalCount / query.limit),
        }
      }

      // Cache for 10 minutes
      await cacheService.set(cacheKey, JSON.stringify(result), 600)

      return reply.send(result)

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Parâmetros inválidos',
          details: error.errors
        })
      }

      request.log.error('Get properties error:', error)
      return reply.status(500).send({
        error: 'Erro interno',
        message: 'Não foi possível carregar as propriedades.'
      })
    }
  }

  // Get single property
  async getProperty(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string }
      const cacheKey = `property:${id}`

      // Try cache first
      const cached = await cacheService.getCachedProperty(id)
      if (cached) {
        return reply.send(cached)
      }

      const property = await prisma.property.findFirst({
        where: {
          OR: [
            { id },
            { slug: id }
          ]
        },
        include: {
          images: {
            orderBy: { order: 'asc' }
          },
          amenities: {
            include: {
              amenity: true
            }
          },
          host: {
            select: {
              id: true,
              name: true,
              avatar: true,
              bio: true,
              languages: true,
              createdAt: true,
              hostProfile: {
                select: {
                  isSuperHost: true,
                  superHostSince: true,
                  averageRating: true,
                  responseRate: true,
                  responseTime: true,
                  totalBookings: true,
                  identityVerified: true,
                }
              }
            }
          },
          reviews: {
            take: 10,
            orderBy: { createdAt: 'desc' },
            include: {
              author: {
                select: {
                  id: true,
                  name: true,
                  avatar: true,
                }
              }
            }
          },
          _count: {
            select: {
              reviews: true,
              bookings: true,
            }
          }
        }
      })

      if (!property) {
        return reply.status(404).send({
          error: 'Propriedade não encontrada'
        })
      }

      // Increment view count (async)
      prisma.property.update({
        where: { id: property.id },
        data: { viewCount: { increment: 1 } }
      }).catch(error => {
        request.log.error('Failed to increment view count:', error)
      })

      // Get availability for next 30 days
      const today = new Date()
      const thirtyDaysLater = new Date(today)
      thirtyDaysLater.setDate(today.getDate() + 30)

      const availability = await prisma.propertyAvailability.findMany({
        where: {
          propertyId: property.id,
          date: {
            gte: today,
            lte: thirtyDaysLater,
          }
        },
        orderBy: { date: 'asc' }
      })

      const result = {
        ...property,
        amenities: property.amenities.map(pa => pa.amenity),
        reviewCount: property._count.reviews,
        bookingCount: property._count.bookings,
        availability: availability.map(a => ({
          date: a.date,
          available: !a.isBlocked,
          price: a.price || property.basePrice,
        })),
      }

      // Cache for 1 hour
      await cacheService.cacheProperty(property.id, result, 3600)

      return reply.send(result)

    } catch (error) {
      request.log.error('Get property error:', error)
      return reply.status(500).send({
        error: 'Erro interno',
        message: 'Não foi possível carregar a propriedade.'
      })
    }
  }

  // Update property
  async updateProperty(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string }
      const body = updatePropertySchema.parse(request.body)
      const hostId = request.user!.id

      // Find property and verify ownership
      const existingProperty = await prisma.property.findUnique({
        where: { id }
      })

      if (!existingProperty) {
        return reply.status(404).send({
          error: 'Propriedade não encontrada'
        })
      }

      if (existingProperty.hostId !== hostId) {
        return reply.status(403).send({
          error: 'Acesso negado',
          message: 'Você não tem permissão para editar esta propriedade.'
        })
      }

      // Prepare update data
      const updateData: any = { ...body }

      // Update geocoding if address changed
      if (body.street || body.number || body.neighborhood || body.city || body.state || body.zipCode) {
        const fullAddress = `${body.street || existingProperty.street}, ${body.number || existingProperty.number || ''}, ${body.neighborhood || existingProperty.neighborhood}, ${body.city || existingProperty.city}, ${body.state || existingProperty.state}, ${body.zipCode || existingProperty.zipCode}, Brasil`
        
        const geocodeResult = await this.geocodeService.geocode(fullAddress)
        if (geocodeResult) {
          updateData.latitude = geocodeResult.lat
          updateData.longitude = geocodeResult.lng
        }
      }

      // Update service fee if base price changed
      if (body.basePrice) {
        updateData.serviceFee = body.basePrice * business.hostFeePercent
      }

      // Format zipCode
      if (body.zipCode) {
        updateData.zipCode = body.zipCode.replace(/\D/g, '').replace(/(\d{5})(\d{3})/, '$1-$2')
      }

      // Update SEO fields if title or city changed
      if (body.title || body.city) {
        const title = body.title || existingProperty.title
        const city = body.city || existingProperty.city
        const state = body.state || existingProperty.state
        
        updateData.seoTitle = `${title} - ${city}, ${state} | HospedeFácil`
        updateData.seoDescription = `Alugue ${title.toLowerCase()} em ${city}, ${state}. A partir de R$ ${(body.basePrice || existingProperty.basePrice).toFixed(2)}/diária.`
      }

      // Update property
      const property = await prisma.property.update({
        where: { id },
        data: updateData,
        include: {
          images: {
            orderBy: { order: 'asc' }
          },
          amenities: {
            include: {
              amenity: true
            }
          },
          host: {
            select: {
              id: true,
              name: true,
              avatar: true,
              hostProfile: {
                select: {
                  isSuperHost: true,
                  averageRating: true,
                }
              }
            }
          }
        }
      })

      // Update amenities if provided
      if (body.amenities) {
        // Remove existing amenities
        await prisma.propertyAmenity.deleteMany({
          where: { propertyId: id }
        })

        // Add new amenities
        if (body.amenities.length > 0) {
          const amenities = await prisma.amenity.findMany({
            where: { id: { in: body.amenities } }
          })

          if (amenities.length > 0) {
            await prisma.propertyAmenity.createMany({
              data: amenities.map(amenity => ({
                propertyId: id,
                amenityId: amenity.id,
              }))
            })
          }
        }
      }

      // Invalidate cache
      await cacheService.del(`property:${id}`)
      await cacheService.invalidatePattern('properties:*')

      return reply.send({
        message: 'Propriedade atualizada com sucesso!',
        property: {
          ...property,
          amenities: property.amenities.map(pa => pa.amenity),
        }
      })

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Dados inválidos',
          details: error.errors
        })
      }

      request.log.error('Update property error:', error)
      return reply.status(500).send({
        error: 'Erro interno',
        message: 'Não foi possível atualizar a propriedade.'
      })
    }
  }

  // Upload property images
  async uploadImages(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string }
      const hostId = request.user!.id

      // Verify property ownership
      const property = await prisma.property.findUnique({
        where: { id },
        include: {
          images: true
        }
      })

      if (!property) {
        return reply.status(404).send({
          error: 'Propriedade não encontrada'
        })
      }

      if (property.hostId !== hostId) {
        return reply.status(403).send({
          error: 'Acesso negado'
        })
      }

      // Check image limit
      if (property.images.length >= business.maxImages) {
        return reply.status(400).send({
          error: 'Limite de imagens excedido',
          message: `Máximo de ${business.maxImages} imagens por propriedade.`
        })
      }

      const files = await request.saveRequestFiles()
      if (files.length === 0) {
        return reply.status(400).send({
          error: 'Nenhuma imagem enviada'
        })
      }

      const uploadedImages = []

      for (const file of files) {
        // Validate file
        if (!business.allowedImageTypes.includes(file.mimetype)) {
          continue // Skip invalid files
        }

        if (file.file.bytesRead > business.maxImageSize) {
          continue // Skip large files
        }

        try {
          // Upload to Cloudinary
          const cloudinaryResult = await this.cloudinaryService.uploadImage(
            file.filepath,
            `properties/${id}`
          )

          if (cloudinaryResult) {
            // Save to database
            const image = await prisma.propertyImage.create({
              data: {
                propertyId: id,
                url: cloudinaryResult.secure_url,
                alt: `${property.title} - Imagem`,
                order: property.images.length + uploadedImages.length,
              }
            })

            uploadedImages.push(image)
          }
        } catch (uploadError) {
          request.log.error('Image upload error:', uploadError)
          continue // Skip failed uploads
        }
      }

      // Invalidate cache
      await cacheService.del(`property:${id}`)

      return reply.send({
        message: `${uploadedImages.length} imagem(ns) enviada(s) com sucesso!`,
        images: uploadedImages
      })

    } catch (error) {
      request.log.error('Upload images error:', error)
      return reply.status(500).send({
        error: 'Erro interno',
        message: 'Não foi possível fazer upload das imagens.'
      })
    }
  }

  // Delete property
  async deleteProperty(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string }
      const hostId = request.user!.id

      // Find property and verify ownership
      const property = await prisma.property.findUnique({
        where: { id },
        include: {
          bookings: {
            where: {
              status: { in: ['CONFIRMED', 'IN_PROGRESS'] }
            }
          }
        }
      })

      if (!property) {
        return reply.status(404).send({
          error: 'Propriedade não encontrada'
        })
      }

      if (property.hostId !== hostId) {
        return reply.status(403).send({
          error: 'Acesso negado'
        })
      }

      // Check for active bookings
      if (property.bookings.length > 0) {
        return reply.status(400).send({
          error: 'Não é possível excluir',
          message: 'Existe(m) reserva(s) ativa(s) para esta propriedade.'
        })
      }

      // Soft delete (set status to inactive)
      await prisma.property.update({
        where: { id },
        data: { status: 'INACTIVE' }
      })

      // Invalidate cache
      await cacheService.del(`property:${id}`)
      await cacheService.invalidatePattern('properties:*')

      return reply.send({
        message: 'Propriedade removida com sucesso!'
      })

    } catch (error) {
      request.log.error('Delete property error:', error)
      return reply.status(500).send({
        error: 'Erro interno',
        message: 'Não foi possível remover a propriedade.'
      })
    }
  }

  // Get host properties
  async getHostProperties(request: FastifyRequest, reply: FastifyReply) {
    try {
      const hostId = request.user!.id
      const query = propertyQuerySchema.parse(request.query)

      const where = {
        hostId,
        ...(query.status && { status: query.status }),
      }

      const totalCount = await prisma.property.count({ where })

      const properties = await prisma.property.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          images: {
            orderBy: { order: 'asc' },
            take: 1,
          },
          _count: {
            select: {
              bookings: true,
              reviews: true,
            }
          }
        }
      })

      return reply.send({
        properties,
        pagination: {
          page: query.page,
          limit: query.limit,
          total: totalCount,
          pages: Math.ceil(totalCount / query.limit),
        }
      })

    } catch (error) {
      request.log.error('Get host properties error:', error)
      return reply.status(500).send({
        error: 'Erro interno',
        message: 'Não foi possível carregar suas propriedades.'
      })
    }
  }

  // Helper methods
  private generateSlug(title: string, city: string): string {
    const slug = `${title}-${city}`
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Remove multiple hyphens
      .trim()
      .substring(0, 100) // Limit length

    return slug
  }
}
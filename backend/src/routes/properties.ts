import { FastifyPluginAsync } from 'fastify'
import { PropertyController } from '@/controllers/properties.js'

const propertyRoutes: FastifyPluginAsync = async (fastify) => {
  const propertyController = new PropertyController()

  // Public routes
  fastify.get('/', {
    schema: {
      description: 'Listar propriedades com filtros',
      tags: ['Properties'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'string', description: 'Página' },
          limit: { type: 'string', description: 'Itens por página' },
          city: { type: 'string', description: 'Cidade' },
          state: { type: 'string', description: 'Estado' },
          minPrice: { type: 'string', description: 'Preço mínimo' },
          maxPrice: { type: 'string', description: 'Preço máximo' },
          bedrooms: { type: 'string', description: 'Número de quartos' },
          maxGuests: { type: 'string', description: 'Máximo de hóspedes' },
          sort: { 
            type: 'string', 
            enum: ['newest', 'oldest', 'price-asc', 'price-desc', 'rating'],
            description: 'Ordenação' 
          },
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            properties: { type: 'array' },
            pagination: { type: 'object' }
          }
        }
      }
    }
  }, propertyController.getProperties.bind(propertyController))

  fastify.get('/:id', {
    schema: {
      description: 'Obter propriedade por ID ou slug',
      tags: ['Properties'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'ID ou slug da propriedade' }
        }
      }
    }
  }, propertyController.getProperty.bind(propertyController))

  // Protected routes
  fastify.register(async (fastify) => {
    // Add authentication
    fastify.addHook('onRequest', fastify.authenticate)

    // Create property (hosts only)
    fastify.post('/', {
      preHandler: fastify.requireHost,
      schema: {
        description: 'Criar nova propriedade',
        tags: ['Properties'],
        security: [{ Bearer: [] }],
        body: {
          type: 'object',
          required: [
            'title', 'description', 'type', 'street', 'neighborhood', 
            'city', 'state', 'zipCode', 'bedrooms', 'bathrooms', 
            'beds', 'maxGuests', 'basePrice', 'checkInTime', 
            'checkOutTime', 'minStay', 'maxStay'
          ],
          properties: {
            title: { type: 'string', minLength: 10, maxLength: 100 },
            description: { type: 'string', minLength: 50, maxLength: 2000 },
            type: { 
              type: 'string', 
              enum: ['APARTMENT', 'HOUSE', 'CONDO', 'LOFT', 'STUDIO', 'FARM', 'CHALET', 'BOAT', 'OTHER']
            },
            street: { type: 'string', minLength: 5 },
            number: { type: 'string' },
            complement: { type: 'string' },
            neighborhood: { type: 'string', minLength: 2 },
            city: { type: 'string', minLength: 2 },
            state: { type: 'string', minLength: 2, maxLength: 2 },
            zipCode: { type: 'string', pattern: '^\\d{5}-?\\d{3}$' },
            bedrooms: { type: 'number', minimum: 0, maximum: 20 },
            bathrooms: { type: 'number', minimum: 1, maximum: 20 },
            beds: { type: 'number', minimum: 1, maximum: 50 },
            maxGuests: { type: 'number', minimum: 1, maximum: 50 },
            area: { type: 'number', minimum: 0 },
            basePrice: { type: 'number', minimum: 0.01 },
            cleaningFee: { type: 'number', minimum: 0 },
            checkInTime: { type: 'string', pattern: '^\\d{2}:\\d{2}$' },
            checkOutTime: { type: 'string', pattern: '^\\d{2}:\\d{2}$' },
            minStay: { type: 'number', minimum: 1, maximum: 365 },
            maxStay: { type: 'number', minimum: 1, maximum: 365 },
            smokingAllowed: { type: 'boolean' },
            petsAllowed: { type: 'boolean' },
            partiesAllowed: { type: 'boolean' },
            amenities: { type: 'array', items: { type: 'string' } },
          }
        }
      }
    }, propertyController.createProperty.bind(propertyController))

    // Update property
    fastify.put('/:id', {
      preHandler: fastify.requireHost,
      schema: {
        description: 'Atualizar propriedade',
        tags: ['Properties'],
        security: [{ Bearer: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' }
          }
        }
      }
    }, propertyController.updateProperty.bind(propertyController))

    // Upload images
    fastify.post('/:id/images', {
      preHandler: fastify.requireHost,
      schema: {
        description: 'Upload de imagens da propriedade',
        tags: ['Properties'],
        security: [{ Bearer: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' }
          }
        },
        consumes: ['multipart/form-data']
      }
    }, propertyController.uploadImages.bind(propertyController))

    // Delete property
    fastify.delete('/:id', {
      preHandler: fastify.requireHost,
      schema: {
        description: 'Remover propriedade',
        tags: ['Properties'],
        security: [{ Bearer: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' }
          }
        }
      }
    }, propertyController.deleteProperty.bind(propertyController))

    // Get host properties
    fastify.get('/host/my-properties', {
      preHandler: fastify.requireHost,
      schema: {
        description: 'Listar propriedades do anfitrião',
        tags: ['Properties'],
        security: [{ Bearer: [] }]
      }
    }, propertyController.getHostProperties.bind(propertyController))
  })
}

export { propertyRoutes }
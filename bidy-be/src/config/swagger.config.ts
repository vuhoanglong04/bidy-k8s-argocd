import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'BE Auction API',
      version: '1.0.0',
      description: 'API documentation for the BE Auction platform.',
    },
    servers: [
      { url: 'http://localhost:8080', description: 'Local development server' },
      { url: 'https://api.bidy.vn', description: 'Production server' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  // Scan tất cả DTOs, routes, controllers — cả modules mới lẫn routes cũ
  apis: [
    './src/routes/**/*.ts',
    './src/modules/**/*.dto.ts',
    './src/modules/**/*.route.ts',
    './src/modules/**/*.controller.ts',
  ],
};

export const swaggerSpec = swaggerJsdoc(options);

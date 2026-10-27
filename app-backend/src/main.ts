import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { configureApp } from './app.setup';
import { validateSecrets } from './common/utils/validate-secrets';

async function bootstrap() {
  validateSecrets();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const isProd = process.env.NODE_ENV === 'production';

  configureApp(app);

  // Enable CORS - Support multiple origins
  if (isProd && !process.env.CORS_ORIGIN) {
    throw new Error('CORS_ORIGIN must be set in production');
  }
  const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
  const allowedOrigins = corsOrigin.split(',').map(origin => origin.trim());

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  // Serve static files (uploads)
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
    },
  });

  // Swagger documentation: opt-in only (ENABLE_SWAGGER=true), never implicit
  const swaggerEnabled = process.env.ENABLE_SWAGGER === 'true' && !isProd;
  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('AgroTwin API')
      .setDescription('API for AgroTwin digital twin platform')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('auth', 'Authentication endpoints')
      .addTag('tenants', 'Tenant management')
      .addTag('users', 'User management')
      .addTag('sites', 'Site management')
      .addTag('clusters', 'Cluster management')
      .addTag('devices', 'Device management')
      .addTag('sensors', 'Sensor management')
      .addTag('media', 'Media upload and management')
      .addTag('reports', 'Reports and analytics')
      .addTag('alerts', 'Alerts and notifications')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT || 3001;
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`Application running on http://localhost:${port} (${process.env.NODE_ENV || 'development'})`);
  if (swaggerEnabled) {
    logger.log(`Swagger documentation: http://localhost:${port}/api/docs`);
  }
}
bootstrap();

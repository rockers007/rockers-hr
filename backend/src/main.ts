import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Security headers. Helmet sets a sensible baseline for an API server:
  // HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, etc.
  // CSP is disabled here because this server returns JSON, not HTML — the
  // frontend (Next.js) is responsible for its own CSP. cross-origin
  // resource/embedder policies are relaxed so CloudFront + S3 assets and
  // Swagger UI continue to work.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      strictTransportSecurity: {
        maxAge: 63072000, // 2 years
        includeSubDomains: true,
        preload: true,
      },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );

  // CORS
  // FRONTEND_URL is a comma-separated list of allowed origins so a
  // single deploy can serve a production frontend, a staging frontend,
  // and (during development) one-off ngrok tunnels at the same time
  // without rebuilding the server. Trailing slashes and stray spaces
  // are trimmed because that's a common mistake when pasting URLs
  // into Render / Railway / Vercel env-var UIs.
  //
  // ngrok-specific note: free ngrok URLs change every restart. Either
  // list the current URL here (and restart Render) or use the wildcard
  // `*.ngrok-free.app` shape with the regex form Express's `cors`
  // middleware accepts — implemented below.
  const frontendUrls = (
    configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3000'
  )
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  app.enableCors({
    origin: (origin, callback) => {
      // Server-to-server / curl / mobile-app requests have no Origin
      // header — let those through unchanged.
      if (!origin) return callback(null, true);
      const trimmed = origin.replace(/\/+$/, '');
      const allowed = frontendUrls.some((entry) => {
        // Plain string match.
        if (entry === trimmed) return true;
        // Wildcard form, e.g. "https://*.ngrok-free.app".
        if (entry.includes('*')) {
          const pattern = new RegExp(
            '^' +
              entry
                .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
                .replace(/\*/g, '[^/]+') +
              '$',
          );
          return pattern.test(trimmed);
        }
        return false;
      });
      if (allowed) return callback(null, true);
      return callback(new Error(`CORS: origin ${origin} not allowed`), false);
    },
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Global response envelope interceptor
  app.useGlobalInterceptors(new ResponseInterceptor());

  // Global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Swagger (dev only)
  if (configService.get<string>('NODE_ENV') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Rockers HR API')
      .setDescription('HR Management System API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = configService.get<number>('API_PORT', 4000);
  await app.listen(port);
  console.log(`Rockers HR API running on port ${port}`);
}
bootstrap();

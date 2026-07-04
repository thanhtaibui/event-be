import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AllExceptionFilter } from './common/filters/all-exception.filter';
import { ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT ?? 3000);
  const serverUrl =
    process.env.API_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    `http://localhost:${port}`;
  const corsOrigins = (process.env.CORS_ORIGIN || process.env.FE_URL || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const config = new DocumentBuilder()
    .setTitle('Events API')
    .setDescription('The Events API description')
    .setVersion('1.0')
    .addServer(serverUrl)
    .addBasicAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Nhập Access Token của bạn vào đây',
        in: 'header',
      },
      'access-token',
    )
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, documentFactory, {
    swaggerOptions: {
      docExpansion: 'none',
      filter: true,
    },
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.use(cookieParser.default());

  //bật CORS để cho phép các client từ các domain khác nhau có thể truy cập API của bạn. Điều này rất hữu ích khi bạn có frontend và backend được triển khai trên các domain khác nhau hoặc khi bạn muốn cho phép truy cập từ các công cụ như Postman hoặc Swagger UI.
  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : 'http://localhost:5173',
    credentials: true,
  });
  app.useGlobalFilters(new AllExceptionFilter());

  await app.listen(port);
}
bootstrap();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AllExceptionFilter } from './common/filters/all-exception.filter';
import { ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = new DocumentBuilder()
    .setTitle('Events API')
    .setDescription('The Events API description')
    .setVersion('1.0')
    .addServer('http://localhost:3000')
    .addBasicAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      name: 'JWT',
      description: 'Nhập Access Token của bạn vào đây',
      in: 'header',
    },
      'access-token')
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, documentFactory, {
    swaggerOptions: {
      docExpansion: 'none',
      filter: true
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
    origin: 'http://localhost:5173', // Thay đổi thành domain của frontend nếu cần
    credentials: true
  });
  app.useGlobalFilters(new AllExceptionFilter());

  await app.listen(process.env.PORT ?? 3000);

}
bootstrap();

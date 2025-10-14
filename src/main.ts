import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BadRequestException, ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) => {
        const messages = errors.map((error) => ({
          field: error.property,
          message: error.constraints
            ? Object.values(error.constraints).join('. ') + '.'
            : '',
        }));
        return new BadRequestException({ errors: messages });
      },
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();

import { NestFactory } from '@nestjs/core';
import configuration from './configuration';
import { ValidationPipe } from '@nestjs/common';
import * as bodyParser from 'body-parser';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './modules/app.module';
import { HttpExceptionFilter } from './middleware/http.exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe());
  app.enableCors({ origin: '*' });
  // The raw body too, for checking Paystack's webhook signature.
  app.use(
    bodyParser.json({
      limit: '100mb',
      verify: (req: any, _res, buf: Buffer) => {
        req.rawBody = buf;
      },
    }),
  );
  app.use(bodyParser.urlencoded({ limit: '100mb', extended: true }));

  //

  // global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());
  ///
  const config = new DocumentBuilder()
    .setTitle('Income Expense Tracker')
    .setDescription('Income Expense Tracker API Documentation')
    .setVersion('1.0')
    .addTag('IE Tracker')
    .build();
  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('/', app, document);
  await app.listen(configuration().port, () => {
    console.log(
      `Server is running on http://localhost:${configuration().port}`,
    );
  });
}
bootstrap();

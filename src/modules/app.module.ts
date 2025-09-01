import {
  MiddlewareConsumer,
  Module,
  RequestMethod,
  Patch,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';
import loadControllers from 'src/functions/load.controllers';
import loadServices from 'src/functions/load.services';
import { JwtModule } from '@nestjs/jwt';
import constants from 'src/constants';
import loadRepositories from 'src/functions/load.repositories';
import { GoogleAuthStrategy } from 'src/providers/google.auth.strategy';
import { LocalStrategy } from 'src/providers/local.strategy';
import { JwtStrategy } from 'src/providers/jwt.strategy';
import configuration from 'src/configuration';
import { AuthMiddleware } from 'src/middleware/auth.middleware';
import { loadSchemas } from 'src/functions/load.schemas';
import loadActors from 'src/functions/load.actors';
import { RolesGuard } from 'src/providers/roles.guard';
import { SubscriptionMiddleware } from 'src/middleware/subscription.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
      isGlobal: true,
      load: [configuration],
      ignoreEnvFile: true,
    }),
    MongooseModule.forRoot(configuration().dbConnectionString),
    MongooseModule.forFeature([...loadSchemas()]),
    ScheduleModule.forRoot(),
    JwtModule.register({
      global: true,
      secret: constants().secret,
      signOptions: { expiresIn: '3600000hrs' },
    }),
    HttpModule.register({
      timeout: 5000,
    }),
  ],
  controllers: [...loadControllers],
  providers: [
    GoogleAuthStrategy,
    LocalStrategy,
    JwtStrategy,
    RolesGuard,
    ...loadRepositories,
    ...loadServices,
    ...loadActors,
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(SubscriptionMiddleware)
      .exclude(
        // auth endpoints
        { path: 'api/authentication/login', method: RequestMethod.POST },
        { path: 'api/authentication/otp-verify', method: RequestMethod.PATCH },
        { path: 'api/authentication/otp-resend', method: RequestMethod.POST },
        { path: 'api/authentication/google-auth', method: RequestMethod.POST },
        { path: 'api/authentication/logout', method: RequestMethod.POST },
        { path: 'api/authentication/profile', method: RequestMethod.GET },
        { path: 'api/authentication/register', method: RequestMethod.POST },

        //billing plans
        { path: 'api/billing-plans', method: RequestMethod.GET }, // get all plans
        { path: 'api/billing-plans', method: RequestMethod.POST }, // add plan
        { path: 'api/billing-plans/(.*)', method: RequestMethod.GET }, // get plan by id
        { path: 'api/billing-plans/(.*)', method: RequestMethod.PATCH }, // update plan by id

        // subscriptions
        { path: 'api/subscriptions', method: RequestMethod.POST }, // create
        { path: 'api/subscriptions/(.*)', method: RequestMethod.GET }, // any GET under /subscriptions/*

        // invoices
        { path: 'api/invoices/pay/(.*)', method: RequestMethod.POST }, // /pay/:id
        { path: 'api/invoices/update-status', method: RequestMethod.GET },
        { path: 'api/invoices/client', method: RequestMethod.GET },
        { path: 'api/invoices/(.*)', method: RequestMethod.GET }, // /:invoiceId and any other GET under invoices
      )
      .forRoutes({
        path: '*',
        method: RequestMethod.ALL,
      });

    consumer
      .apply(AuthMiddleware)
      .exclude(
        { path: 'api/authentication/login', method: RequestMethod.POST },
        { path: 'api/authentication/otp-verify', method: RequestMethod.PATCH },
        { path: 'api/authentication/otp-resend', method: RequestMethod.POST },
        { path: 'api/authentication/logout', method: RequestMethod.POST },
        { path: 'api/authentication/google-auth', method: RequestMethod.POST },
        { path: 'api/authentication/register', method: RequestMethod.POST },
      )
      .forRoutes({
        path: '*',
        method: RequestMethod.ALL,
      });
  }
}

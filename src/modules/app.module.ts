import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
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
      .apply(AuthMiddleware)
      .exclude(
        { path: 'api/authentication/login', method: RequestMethod.POST },
        { path: 'api/authentication/otp-verify', method: RequestMethod.PATCH },
        { path: 'api/authentication/otp-resend', method: RequestMethod.POST },
        { path: 'api/authentication/logout', method: RequestMethod.POST },
      )
      .forRoutes({
        path: '*',
        method: RequestMethod.ALL,
      });
  }
}

import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UserModule } from './user/user.module';
import configuration from './configuration';
import { AuthModule } from './auth/auth.module';
import { MongooseModule } from '@nestjs/mongoose';
import { CategoryModule } from './category/category.module';
import { TransactionModule } from './transaction/transaction.module';
import { AuthMiddleware } from './middleware/auth.middleware';
import { User, UserSchema } from './schemas/user.schema.dto';
import { UserRepository } from './repositories/user.repository';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
      isGlobal: true,
      load: [configuration],
    }),
    MongooseModule.forRoot(configuration().dbConnectionString),
    UserModule,
    AuthModule,
    CategoryModule,
    TransactionModule,
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  controllers: [],
  providers: [UserRepository],
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

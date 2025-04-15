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
import { BudgetCategoryModule } from './budget-category/budget-category.module';
import { BudgetModule } from './budget/budget.module';
import { ReportsModule } from './reports/reports.module';
import { HttpModule } from '@nestjs/axios';
import { EventsModule } from './events/events.module';
import { JobSchedulerService } from './providers/job.scheduler.service';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
      isGlobal: true,
      load: [configuration],
      ignoreEnvFile: true,
    }),
    MongooseModule.forRoot(configuration().dbConnectionString),
    UserModule,
    AuthModule,
    CategoryModule,
    TransactionModule,
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    BudgetCategoryModule,
    BudgetModule,
    ReportsModule,
    HttpModule.register({
      timeout: 5000,
    }),
    EventsModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [],
  providers: [UserRepository, JobSchedulerService],
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

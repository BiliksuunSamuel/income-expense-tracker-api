import { Module } from '@nestjs/common';
import { BudgetService } from './budget.service';
import { BudgetController } from './budget.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Budget, BudgetSchema } from 'src/schemas/budget.schema.dto';
import { BudgetRepository } from 'src/repositories/budget.repository';
import { BudgetActor } from 'src/actors/budget.actor';
import { NotificationsActor } from 'src/actors/notification.actor';
import { FirebaseService } from 'src/providers/firebase.service';
import { MailService } from 'src/providers/mail.service';
import { ProxyHttpService } from 'src/providers/proxy-http.service';
import { HttpModule } from '@nestjs/axios';
import { User, UserSchema } from 'src/schemas/user.schema.dto';
import { UserRepository } from 'src/repositories/user.repository';

@Module({
  providers: [
    BudgetService,
    BudgetRepository,
    BudgetActor,
    NotificationsActor,
    FirebaseService,
    MailService,
    ProxyHttpService,
    UserRepository,
  ],
  controllers: [BudgetController],
  imports: [
    MongooseModule.forFeature([
      { name: Budget.name, schema: BudgetSchema },
      { name: User.name, schema: UserSchema },
    ]),
    HttpModule.register({
      timeout: 5000,
    }),
  ],
})
export class BudgetModule {}

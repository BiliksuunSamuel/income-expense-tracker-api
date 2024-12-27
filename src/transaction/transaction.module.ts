import { Module } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { TransactionController } from './transaction.controller';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Transaction,
  TransactionSchema,
} from 'src/schemas/transaction.schema.dto';
import { TransactionRepository } from 'src/repositories/transaction.repository';
import { ImageService } from 'src/providers/image.service';
import { Budget, BudgetSchema } from 'src/schemas/budget.schema.dto';
import { BudgetActor } from 'src/actors/budget.actor';
import { BudgetRepository } from 'src/repositories/budget.repository';
import { NotificationsActor } from 'src/actors/notification.actor';
import { FirebaseService } from 'src/providers/firebase.service';
import { MailService } from 'src/providers/mail.service';
import { ProxyHttpService } from 'src/providers/proxy-http.service';
import { HttpModule } from '@nestjs/axios';
import { User, UserSchema } from 'src/schemas/user.schema.dto';
import { UserRepository } from 'src/repositories/user.repository';
import { Category, CategorySchema } from 'src/schemas/category.schema';
import { CategoryActor } from 'src/actors/category.actor';
import { CategoryRepository } from 'src/repositories/category.repository';

@Module({
  providers: [
    TransactionService,
    TransactionRepository,
    BudgetRepository,
    ImageService,
    BudgetActor,
    NotificationsActor,
    ProxyHttpService,
    FirebaseService,
    MailService,
    UserRepository,
    CategoryActor,
    CategoryRepository,
  ],
  controllers: [TransactionController],
  imports: [
    MongooseModule.forFeature([
      { name: Transaction.name, schema: TransactionSchema },
      { name: Budget.name, schema: BudgetSchema },
      { name: User.name, schema: UserSchema },
      { name: Category.name, schema: CategorySchema },
    ]),
    HttpModule.register({
      timeout: 5000,
    }),
  ],
})
export class TransactionModule {}

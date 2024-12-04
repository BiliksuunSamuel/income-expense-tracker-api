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

@Module({
  providers: [TransactionService, TransactionRepository, ImageService],
  controllers: [TransactionController],
  imports: [
    MongooseModule.forFeature([
      { name: Transaction.name, schema: TransactionSchema },
    ]),
  ],
})
export class TransactionModule {}

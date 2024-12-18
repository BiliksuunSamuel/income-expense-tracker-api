import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Transaction,
  TransactionSchema,
} from 'src/schemas/transaction.schema.dto';
import { ReportsRepository } from 'src/repositories/reports.repository';

@Module({
  providers: [ReportsService, ReportsRepository],
  controllers: [ReportsController],
  imports: [
    MongooseModule.forFeature([
      { name: Transaction.name, schema: TransactionSchema },
    ]),
  ],
})
export class ReportsModule {}

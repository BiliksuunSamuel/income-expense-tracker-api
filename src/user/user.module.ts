import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserRepository } from 'src/repositories/user.repository';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from 'src/schemas/user.schema.dto';

@Module({
  providers: [UserService, UserRepository],
  exports: [UserService],
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
})
export class UserModule {}

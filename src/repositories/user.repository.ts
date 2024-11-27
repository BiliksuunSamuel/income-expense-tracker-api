import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from 'src/schemas/user.schema.dto';

@Injectable()
export class UserRepository {
  private readonly logger = new Logger(UserRepository.name);
  constructor(
    @InjectModel(User.name) private readonly userRepository: Model<User>,
  ) {}

  //get user by id
  async getByIdAsync(id: string): Promise<User> {
    return await this.userRepository.findOne({ id }).lean();
  }
}

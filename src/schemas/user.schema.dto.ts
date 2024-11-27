import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { BaseSchema } from './base.schema.dto';
import { ApiProperty } from '@nestjs/swagger';
import { UserStatus } from 'src/enums';

@Schema()
export class User extends BaseSchema {
  @Prop()
  @ApiProperty()
  firstName: string;

  @Prop()
  @ApiProperty()
  lastName: string;

  @Prop()
  @ApiProperty()
  email: string;

  @Prop()
  @ApiProperty()
  phoneNumber: string;

  @Prop()
  @ApiProperty()
  verificationCode: string;

  @Prop()
  @ApiProperty()
  isLoggedIn: boolean;

  @ApiProperty()
  @Prop()
  picture: string;

  @Prop()
  @ApiProperty()
  status: UserStatus;

  @Prop()
  @ApiProperty()
  tokenId: string;

  @Prop()
  @ApiProperty()
  fcmToken: string;

  @Prop()
  @ApiProperty()
  googleAccessToken: string;

  @Prop()
  @ApiProperty()
  isGoogleAuth: boolean;

  @Prop()
  password: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

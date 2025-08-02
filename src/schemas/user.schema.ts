import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { BaseSchema } from '.';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole, UserStatus } from 'src/enums';

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

  @Prop()
  @ApiProperty()
  emailVerified: boolean;

  @Prop()
  @ApiProperty()
  authenticated: boolean;

  @Prop({ default: false })
  @ApiProperty()
  resetPassword: boolean;

  @Prop()
  @ApiProperty()
  otpExpiryTime: Date;

  @Prop()
  @ApiProperty()
  currency: string;

  @Prop()
  @ApiProperty()
  currencyName: string;

  @Prop({ type: String, enum: UserRole, default: UserRole.User })
  @ApiProperty()
  role: UserRole;
}

export const UserSchema = SchemaFactory.createForClass(User);

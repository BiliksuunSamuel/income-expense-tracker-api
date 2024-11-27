import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { BaseSchema } from './base.schema.dto';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole, UserStatus } from 'src/enums';

@Schema()
export class User extends BaseSchema {
  @Prop()
  @ApiProperty()
  name: string;

  @Prop()
  @ApiProperty()
  phoneNumber: string;

  @ApiProperty()
  @Prop()
  membershipId: string;

  @Prop()
  @ApiProperty()
  email: string;

  @Prop()
  @ApiProperty()
  constituency: string;

  @Prop()
  @ApiProperty()
  constituencyCode: string;

  @Prop()
  @ApiProperty()
  region: string;

  @Prop()
  @ApiProperty()
  verificationCode: string;

  @Prop()
  @ApiProperty()
  otpPrefix: string;

  @Prop()
  @ApiProperty()
  authenticated: boolean;

  @ApiProperty()
  @Prop()
  profileImage: string;

  @Prop()
  @ApiProperty()
  role: UserRole;

  @Prop()
  @ApiProperty()
  status: UserStatus;

  @Prop()
  @ApiProperty()
  tokenId: string;

  @Prop()
  @ApiProperty()
  fcmToken: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

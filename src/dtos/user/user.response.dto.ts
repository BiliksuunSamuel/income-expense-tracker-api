import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Length,
  MaxLength,
  Validate,
} from 'class-validator';
import { UserRole, UserStatus } from 'src/enums';
import { BaseSchema } from 'src/schemas';

export class UserResponse extends BaseSchema {
  @ApiProperty()
  firstName: string;

  @ApiProperty()
  phoneNumber: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  isLoggedIn: boolean;

  @ApiProperty()
  picture: string;

  @ApiProperty()
  status: UserStatus;

  @ApiProperty()
  currency: string;

  @ApiProperty()
  tokenId: string;
}

enum ServiceType {
  MANICURE = 'MANICURE',
  PEDICURE = 'PEDICURE',
  HAIRCUT = 'HAIRCUT',
}

class FutureDateConstraint {
  validate(value: string) {
    const date = new Date(value);
    return date.getTime() >= Date.now() + 15 * 60 * 1000;
  }
  defaultMessage() {
    return 'startsAt must be at least 15 minutes in the future';
  }
}

export class CreateBookingDto {
  @IsString()
  @Length(2, 80)
  @IsNotEmpty()
  clientName: string;

  @IsString()
  @IsPhoneNumber('GH') //eg. Ghana
  clientPhone: string;

  @IsEnum(ServiceType)
  service: ServiceType;

  @IsISO8601()
  @Validate(FutureDateConstraint)
  startsAt: Date;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  notes?: string;
}

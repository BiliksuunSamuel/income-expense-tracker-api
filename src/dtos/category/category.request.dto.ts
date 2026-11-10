import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { CategoryColor, CategoryIcon, CategoryKind } from 'src/enums';

export class CategoryRequest {
  /** Made by the app so a retried create saves once. */
  @ApiProperty({ required: false })
  @IsOptional()
  @Matches(/^[A-Za-z0-9-]{8,64}$/)
  id?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  title: string;

  /** Older apps leave it out; their categories are for expenses. */
  @ApiProperty({ enum: CategoryKind, required: false })
  @IsOptional()
  @IsEnum(CategoryKind)
  kind?: CategoryKind;

  @ApiProperty({ enum: CategoryIcon, required: false })
  @IsOptional()
  @IsEnum(CategoryIcon)
  icon?: CategoryIcon;

  @ApiProperty({ enum: CategoryColor, required: false })
  @IsOptional()
  @IsEnum(CategoryColor)
  color?: CategoryColor;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  parentId?: string | null;
}

export class CategoryUpdate {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  title?: string;

  @ApiProperty({ enum: CategoryIcon, required: false })
  @IsOptional()
  @IsEnum(CategoryIcon)
  icon?: CategoryIcon;

  @ApiProperty({ enum: CategoryColor, required: false })
  @IsOptional()
  @IsEnum(CategoryColor)
  color?: CategoryColor;

  /** null moves it to the top level. */
  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  parentId?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}

export class CategoryOrder {
  /** The user's category ids in the order to show them. */
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  ids: string[];
}

export class CategoryResponse {
  @ApiProperty() id: string;
  @ApiProperty() title: string;
  @ApiProperty({ enum: CategoryKind }) kind: CategoryKind;
  @ApiProperty({ enum: CategoryIcon }) icon: CategoryIcon;
  @ApiProperty({ enum: CategoryColor }) color: CategoryColor;
  @ApiProperty({ nullable: true }) parentId: string | null;
  @ApiProperty() position: number;
  @ApiProperty() archived: boolean;
}

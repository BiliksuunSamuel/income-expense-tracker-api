import { Prop, Schema } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { BaseSchema } from '.';
import {
  CategoryColor,
  CategoryIcon,
  CategoryKind,
  CategoryType,
} from 'src/enums';

/** A user's category. Transactions name it by [title], so a rename is
 * carried into their transactions. */
@Schema()
export class Category extends BaseSchema {
  @Prop()
  @ApiProperty()
  title: string;

  /** Lower-cased [title]; unique per user and kind. */
  @Prop()
  titleKey: string;

  /** The owner's user id. */
  @Prop({ index: true })
  @ApiProperty()
  creatorId: string;

  /** Personal for every current category; General only on old shared ones. */
  @Prop()
  @ApiProperty({ enum: CategoryType })
  type: CategoryType;

  @Prop()
  @ApiProperty({ enum: CategoryKind })
  kind: CategoryKind;

  @Prop({ default: CategoryIcon.Other })
  @ApiProperty({ enum: CategoryIcon })
  icon: CategoryIcon;

  @Prop({ default: CategoryColor.Grey })
  @ApiProperty({ enum: CategoryColor })
  color: CategoryColor;

  /** The category this one sits under (one level only). */
  @Prop({ default: null })
  @ApiProperty({ required: false, nullable: true })
  parentId: string | null;

  /** Where it sits in the user's list (lowest first). */
  @Prop({ default: 0 })
  @ApiProperty()
  position: number;

  /** Hidden from pickers; its history still shows. */
  @Prop({ default: false })
  @ApiProperty()
  archived: boolean;
}

import { Prop, Schema } from '@nestjs/mongoose';

/// A named running number, such as each year's invoice numbers.
@Schema()
export class Counter {
  @Prop({ required: true, unique: true, type: String })
  key: string;

  @Prop({ required: true, type: Number, default: 0 })
  value: number;
}

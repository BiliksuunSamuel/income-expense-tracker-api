import { ApiProperty } from '@nestjs/swagger';

export class CategoryInput {
  @ApiProperty()
  title: string;

  @ApiProperty()
  creatorId: string;
}

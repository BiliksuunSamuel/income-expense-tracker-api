import { ApiProperty } from '@nestjs/swagger';

export class BudgetForDropdownDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  description: string;
}

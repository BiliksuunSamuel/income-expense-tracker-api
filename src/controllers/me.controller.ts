import { Body, Controller, Delete, Get, Res, UseGuards } from '@nestjs/common';
import { ApiBody, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { UserJwtDetails } from 'src/dtos/auth/user.jwt.details';
import { AuthUser } from 'src/extensions/auth.extensions';
import { JwtAuthGuard } from 'src/providers/jwt-auth..guard';
import { PrivacyService } from 'src/services/privacy.service';

@Controller('api/me')
@ApiTags('Me')
@UseGuards(JwtAuthGuard)
export class MeController {
  constructor(private readonly privacyService: PrivacyService) {}

  /** Everything stored about the signed-in user, as a JSON file. */
  @Get('data')
  async exportData(
    @Res() response: Response,
    @AuthUser() user: UserJwtDetails,
  ) {
    const res = await this.privacyService.exportData(user);
    response.status(res.code).send(res);
  }

  /** Deletes the signed-in user's account and data. */
  @Delete()
  @ApiBody({
    schema: { properties: { confirm: { type: 'string', example: 'DELETE' } } },
  })
  async deleteAccount(
    @Body('confirm') confirm: unknown,
    @Res() response: Response,
    @AuthUser() user: UserJwtDetails,
  ) {
    const res = await this.privacyService.deleteAccount(user, confirm);
    response.status(res.code).send(res);
  }
}

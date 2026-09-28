import { Body, Controller, Delete, Get, HttpCode, Patch } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { DeleteMeDto, UpdateMeDto } from './dto/users.dto';
import { AuthenticatedUser, CurrentUser } from '../auth/current-user.decorator';
import { Idempotent } from '../../common/idempotency/idempotency.decorator';

@ApiTags('me')
@Controller('me')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'اطلاعات حساب کاربری' })
  async me(@CurrentUser() user: AuthenticatedUser) {
    return this.users.me(user.userId);
  }

  @Patch()
  @Idempotent()
  @ApiOperation({ summary: 'ویرایش حساب (شماره موبایل از این مسیر عوض نمی‌شود)' })
  async update(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateMeDto) {
    return this.users.updateMe(user.userId, dto);
  }

  @Delete()
  @HttpCode(202)
  @ApiOperation({ summary: 'حذف حساب با مهلت ۷ روزه' })
  async remove(@CurrentUser() user: AuthenticatedUser, @Body() _dto: DeleteMeDto) {
    return this.users.scheduleDeletion(user.userId);
  }
}

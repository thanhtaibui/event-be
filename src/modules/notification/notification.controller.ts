import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from 'src/common/guards/jwt.guard';
import { ApiResponse } from 'src/common/utils/ApiResponse';
import { NotificationService } from './notification.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationDto } from './dto/notification.dto';

@ApiTags('notification')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  private assertSuperAdmin(req: any) {
    if (!req.user?.role?.isSuperAdmin) {
      throw new ForbiddenException();
    }
  }

  @Post()
  @ApiOperation({ operationId: 'createNotification' })
  create(
    @Req() req: any,
    @Body() createNotificationDto: CreateNotificationDto,
  ): Promise<ApiResponse<NotificationDto>> {
    this.assertSuperAdmin(req);
    return this.notificationService.create(createNotificationDto);
  }

  @Get()
  @ApiOperation({ operationId: 'getMyNotifications' })
  findMyNotifications(@Req() req: any): Promise<ApiResponse<NotificationDto[]>> {
    return this.notificationService.findMyNotifications(req.user.userId);
  }

  @Get('unread-count')
  @ApiOperation({ operationId: 'getUnreadNotificationsCount' })
  getUnreadCount(@Req() req: any): Promise<ApiResponse<{ total: number }>> {
    return this.notificationService.getUnreadCount(req.user.userId);
  }

  @Patch('read-all')
  @ApiOperation({ operationId: 'markAllNotificationsAsRead' })
  markAllAsRead(@Req() req: any): Promise<ApiResponse<{ updated: number }>> {
    return this.notificationService.markAllAsRead(req.user.userId);
  }

  @Patch(':id/read')
  @ApiOperation({ operationId: 'markNotificationAsRead' })
  markAsRead(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
  ): Promise<ApiResponse<NotificationDto>> {
    return this.notificationService.markAsRead(id, req.user.userId);
  }
}

import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PermissionCode } from 'src/common/constants/permission-codes';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { JwtGuard } from 'src/common/guards/jwt.guard';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import { ApiResponse } from 'src/common/utils/ApiResponse';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { FeedbackService } from './feedback.service';

@ApiBearerAuth('access-token')
@UseGuards(JwtGuard)
@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  @ApiOperation({ operationId: 'createFeedback' })
  create(@Body() createFeedbackDto: CreateFeedbackDto, @Req() req: any) {
    return this.feedbackService.create(createFeedbackDto, req.user);
  }

  @Get('event/:eventId')
  @UseGuards(PermissionsGuard)
  @Permissions(PermissionCode.EVENT_VIEW)
  @ApiOperation({ operationId: 'getFeedbackByEvent' })
  findByEvent(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Req() req: any,
  ): Promise<ApiResponse<any[]>> {
    return this.feedbackService.findByEvent(eventId, req.user);
  }
}

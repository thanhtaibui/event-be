import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { OrgVerificationService } from './org-verification.service';
import { CreateOrgVerificationDto } from './dto/create-org-verification.dto';
import { UpdateOrgVerificationDto } from './dto/update-org-verification.dto';
import {
  ApiBody,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { VerificationStatus } from 'src/shared/enum/enum';
import { JwtGuard } from 'src/common/guards/jwt.guard';

@ApiTags('OrgVerification')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard)
@Controller('org-verification')
export class OrgVerificationController {
  constructor(
    private readonly orgVerificationService: OrgVerificationService,
  ) {}

  @Post()
  @ApiOperation({
    operationId: 'submitOrgVerification',
  })
  @ApiBody({
    type: CreateOrgVerificationDto,
    examples: {
      request: {
        summary: 'Submit organization verification',
        value: {
          organizationId: 'b46ed74d-4a79-40a7-a2a1-723be34d951b',
          taxIdNumber: '0312345678',
          documentUrl:
            'https://res.cloudinary.com/demo/image/upload/license.jpg',
        },
      },
    },
  })
  create(
    @Body() createOrgVerificationDto: CreateOrgVerificationDto,
    @Req() req: any,
  ) {
    return this.orgVerificationService.create(
      createOrgVerificationDto,
      req.user.userId,
    );
  }

  @Get()
  @ApiOperation({
    operationId: 'getOrgVerifications',
  })
  @ApiQuery({ name: 'status', enum: VerificationStatus, required: false })
  @ApiQuery({ name: 'organizationId', required: false })
  @ApiQuery({ name: 'requesterId', required: false })
  findAll(
    @Req() req: any,
    @Query('status') status?: VerificationStatus,
    @Query('organizationId') organizationId?: string,
    @Query('requesterId') requesterId?: string,
  ) {
    return this.orgVerificationService.findAll(
      req.user.userId,
      status,
      organizationId,
      requesterId,
    );
  }

  @Get(':id')
  @ApiOperation({
    operationId: 'getOrgVerificationDetail',
  })
  @ApiParam({ name: 'id', description: 'Org verification request id' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.orgVerificationService.findOne(id, req.user.userId);
  }

  @Patch(':id')
  @ApiOperation({
    operationId: 'reviewOrgVerification',
  })
  @ApiParam({ name: 'id', description: 'Org verification request id' })
  @ApiBody({
    type: UpdateOrgVerificationDto,
    examples: {
      approve: {
        summary: 'Approve organization verification',
        value: {
          status: VerificationStatus.APPROVED,
          adminNote: 'Thông tin hợp lệ',
        },
      },
      reject: {
        summary: 'Reject organization verification',
        value: {
          status: VerificationStatus.REJECTED,
          adminNote: 'Giấy tờ chưa rõ hoặc không khớp thông tin tổ chức',
        },
      },
    },
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateOrgVerificationDto: UpdateOrgVerificationDto,
    @Req() req: any,
  ) {
    return this.orgVerificationService.update(
      id,
      updateOrgVerificationDto,
      req.user.userId,
    );
  }

  @Delete(':id')
  @ApiOperation({
    operationId: 'cancelOrgVerification',
  })
  @ApiParam({ name: 'id', description: 'Org verification request id' })
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.orgVerificationService.remove(id, req.user.userId);
  }
}

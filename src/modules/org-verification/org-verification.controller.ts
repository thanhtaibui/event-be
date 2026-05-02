import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { OrgVerificationService } from './org-verification.service';
import { CreateOrgVerificationDto } from './dto/create-org-verification.dto';
import { UpdateOrgVerificationDto } from './dto/update-org-verification.dto';

@Controller('org-verification')
export class OrgVerificationController {
  constructor(private readonly orgVerificationService: OrgVerificationService) {}

  @Post()
  create(@Body() createOrgVerificationDto: CreateOrgVerificationDto) {
    return this.orgVerificationService.create(createOrgVerificationDto);
  }

  @Get()
  findAll() {
    return this.orgVerificationService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.orgVerificationService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateOrgVerificationDto: UpdateOrgVerificationDto) {
    return this.orgVerificationService.update(+id, updateOrgVerificationDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.orgVerificationService.remove(+id);
  }
}

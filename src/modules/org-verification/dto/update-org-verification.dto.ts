import { PartialType } from '@nestjs/swagger';
import { CreateOrgVerificationDto } from './create-org-verification.dto';

export class UpdateOrgVerificationDto extends PartialType(CreateOrgVerificationDto) {}

import { Module } from '@nestjs/common';
import { OrgVerificationService } from './org-verification.service';
import { OrgVerificationController } from './org-verification.controller';

@Module({
  controllers: [OrgVerificationController],
  providers: [OrgVerificationService],
})
export class OrgVerificationModule {}

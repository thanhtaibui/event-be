import { Module } from '@nestjs/common';
import { OrgVerificationService } from './org-verification.service';
import { OrgVerificationController } from './org-verification.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrgVerification } from './entities/org-verification.entity';
import { Organization } from '../organization/entities/organization.entity';
import { User } from '../user/entities/user.entity';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([OrgVerification, Organization, User]),
    UploadModule,
  ],
  controllers: [OrgVerificationController],
  providers: [OrgVerificationService],
})
export class OrgVerificationModule {}

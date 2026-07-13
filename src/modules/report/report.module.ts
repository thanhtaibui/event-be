import { Module } from '@nestjs/common';
import { ReportService } from './report.service';
import { ReportController } from './report.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Report } from './entities/report.entity';
import { User } from '../user/entities/user.entity';
import { Organization } from '../organization/entities/organization.entity';
import { Membership } from '../membership/entities/membership.entity';
@Module({
  imports: [TypeOrmModule.forFeature([Report, User, Organization, Membership])],
  controllers: [ReportController],
  providers: [ReportService],
})
export class ReportModule {}

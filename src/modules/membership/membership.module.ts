import { Module } from '@nestjs/common';
import { MembershipService } from './membership.service';
import { MembershipController } from './membership.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Membership } from './entities/membership.entity';
import { Role } from '../role/entities/role.entity';
import { Organization } from '../organization/entities/organization.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Membership, Role, Organization])],
  controllers: [MembershipController],
  providers: [MembershipService],
})
export class MembershipModule {}

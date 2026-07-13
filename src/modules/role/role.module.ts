import { Module } from '@nestjs/common';
import { RoleService } from './role.service';
import { RoleController } from './role.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from './entities/role.entity';
import { Permission } from '../permission/entities/permission.entity';
import { Organization } from '../organization/entities/organization.entity';
import { Membership } from '../membership/entities/membership.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Role, Permission, Organization, Membership])],
  controllers: [RoleController],
  providers: [RoleService],
})
export class RoleModule {}

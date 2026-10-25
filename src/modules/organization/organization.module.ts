import { Module } from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { OrganizationController } from './organization.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from './entities/organization.entity';
import { Membership } from '../membership/entities/membership.entity';
import { User } from '../user/entities/user.entity';
import { Role } from '../role/entities/role.entity';
import { RoleService } from '../role/role.service';
import { Permission } from '../permission/entities/permission.entity';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { UploadModule } from '../upload/upload.module';
import { Event } from '../event/entities/event.entity';
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Organization,
      Membership,
      User,
      Role,
      Permission,
      Event,
    ]),
    CloudinaryModule,
    UploadModule,
  ],
  controllers: [OrganizationController],
  providers: [OrganizationService, RoleService],
})
export class OrganizationModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailerModule } from '@nestjs-modules/mailer';
import { OrganizationInvitationController } from './organization-invitation.controller';
import { OrganizationInvitationService } from './organization-invitation.service';
import { OrganizationInvitation } from './entities/organization-invitation.entity';
import { Organization } from '../organization/entities/organization.entity';
import { Membership } from '../membership/entities/membership.entity';
import { Role } from '../role/entities/role.entity';
import { User } from '../user/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrganizationInvitation,
      Organization,
      Membership,
      Role,
      User,
    ]),
    MailerModule,
  ],
  controllers: [OrganizationInvitationController],
  providers: [OrganizationInvitationService],
})
export class OrganizationInvitationModule {}

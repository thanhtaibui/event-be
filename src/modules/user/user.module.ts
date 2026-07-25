import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { User } from './entities/user.entity';
import { Membership } from '../membership/entities/membership.entity';
import { Organization } from '../organization/entities/organization.entity';
import { Role } from '../role/entities/role.entity';
import { Ticket } from '../ticket/entities/ticket.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Membership, Organization, Role, Ticket]),
  ],
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}

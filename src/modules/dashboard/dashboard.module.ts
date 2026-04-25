import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity'
import { Event } from '../event/entities/event.entity'
import { Organization } from "../organization/entities/organization.entity"
@Module({
  imports: [
    TypeOrmModule.forFeature([User, Event, Organization]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule { }

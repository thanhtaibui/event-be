import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseConfig } from './configs/database.config';
import { ConfigModule } from '@nestjs/config';
import { EventModule } from './modules/event/event.module';
import { RoleModule } from './modules/role/role.module';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { OrganizationModule } from './modules/organization/organization.module';
import { TicketTypeModule } from './modules/ticket-type/ticket-type.module';
import { TicketModule } from './modules/ticket/ticket.module';
import { ItemModule } from './modules/item/item.module';
import { InviteModule } from './modules/invite/invite.module';
import { FeedbackModule } from './modules/feedback/feedback.module';
import { MembershipModule } from './modules/membership/membership.module';
import { OrderModule } from './modules/order/order.module';
import { ReportModule } from './modules/report/report.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { PermissionModule } from './modules/permission/permission.module';
@Module({
  imports: [
    TypeOrmModule.forRoot(databaseConfig),
    ConfigModule.forRoot({
      isGlobal: true,
      // load: [dbConfig, jwtConfig, refreshJwtConfig],
      envFilePath: '.env',
    }),
    UserModule,
    RoleModule,
    EventModule,
    AuthModule,
    OrganizationModule,
    TicketTypeModule,
    TicketModule,
    ItemModule,
    InviteModule,
    FeedbackModule,
    MembershipModule,
    OrderModule,
    ReportModule,
    DashboardModule,
    PermissionModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }

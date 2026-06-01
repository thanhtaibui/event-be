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
import { OrgVerificationModule } from './modules/org-verification/org-verification.module';
import { CloudinaryModule } from './modules/cloudinary/cloudinary.module';
import { MailerModule } from '@nestjs-modules/mailer';
import { UploadModule } from './modules/upload/upload.module';
import { UploadService } from './modules/upload/upload.service';
import { TicketTypeItemModule } from './modules/ticket-type-item/ticket-type-item.module';
@Module({
  imports: [
    TypeOrmModule.forRoot(databaseConfig),
    ConfigModule.forRoot({
      isGlobal: true,
      // load: [dbConfig, jwtConfig, refreshJwtConfig],
      envFilePath: '.env',
    }),
    MailerModule.forRoot({
      transport: {
        service: 'gmail',

        auth: {
          user: process.env.MAIL_USER,
          pass: process.env.MAIL_PASS,
        },
      },

      defaults: {
        from: process.env.MAIL_USER,
      },
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
    OrgVerificationModule,
    CloudinaryModule,
    UploadModule,
    TicketTypeItemModule,
  ],
  controllers: [AppController],
  providers: [AppService, UploadService],
})
export class AppModule { }

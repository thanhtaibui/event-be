import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseConfig } from './configs/database.config';
import { ConfigModule } from '@nestjs/config';
import { ParticipantModule } from './modules/participant/participant.module';
import { UserRoleModule } from './modules/user-role/user-role.module';
import { EventPostModule } from './modules/event-post/event-post.module';
import { EventInvitationModule } from './modules/event-invitation/event-invitation.module';
import { EventModule } from './modules/event/event.module';
import { RoleModule } from './modules/role/role.module';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
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
    EventInvitationModule,
    EventPostModule,
    UserRoleModule,
    ParticipantModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }

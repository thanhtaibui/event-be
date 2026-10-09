import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/modules/user/entities/user.entity';
import { AiClientService } from './ai-client.service';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { OptionalJwtGuard } from './optional-jwt.guard';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [AiController],
  providers: [AiService, AiClientService, JwtService, OptionalJwtGuard],
})
export class AiModule {}

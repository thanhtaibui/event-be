import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/modules/user/entities/user.entity';
import { AiClientService } from './ai-client.service';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { OptionalJwtGuard } from './optional-jwt.guard';
import { AiImageModule } from 'src/ai-image/ai-image.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), AiImageModule],
  controllers: [AiController],
  providers: [AiService, AiClientService, JwtService, OptionalJwtGuard],
})
export class AiModule {}

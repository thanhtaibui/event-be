import { Module } from '@nestjs/common';
import { InviteService } from './invite.service';
import { InviteController } from './invite.controller';

@Module({
  controllers: [InviteController],
  providers: [InviteService],
})
export class InviteModule {}

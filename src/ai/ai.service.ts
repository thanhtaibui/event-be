import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/modules/user/entities/user.entity';
import { Repository } from 'typeorm';
import { AiClientService } from './ai-client.service';
import { AiChatMode, AiChatResponseDto } from './dto/ai-chat.dto';
import { AiAuthenticatedUser } from './optional-jwt.guard';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly aiClientService: AiClientService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async chat(
    prompt: string,
    mode: AiChatMode = AiChatMode.CHAT,
    user?: AiAuthenticatedUser,
  ): Promise<AiChatResponseDto> {
    const message = prompt?.trim();
    if (!message) {
      throw new BadRequestException('Message is required');
    }

    const safeUserContext = await this.getSafeUserContext(user);

    return this.aiClientService.chat(message, mode, safeUserContext);
  }

  private async getSafeUserContext(
    user?: AiAuthenticatedUser,
  ): Promise<AiAuthenticatedUser | undefined> {
    if (!user?.userId) {
      return user;
    }

    try {
      const userEntity = await this.userRepo.findOne({
        where: { id: user.userId },
        relations: [
          'memberships',
          'memberships.organization',
          'memberships.role',
          'memberships.role.permissions',
        ],
      });

      if (!userEntity) {
        return user;
      }

      const activeMemberships = (userEntity.memberships || []).filter(
        (membership) => membership.isActive && membership.role,
      );
      const permissions = [
        ...new Set(
          activeMemberships.flatMap((membership) =>
            (membership.role.permissions || []).map(
              (permission) => permission.permission_code,
            ),
          ),
        ),
      ];

      return {
        userId: userEntity.id,
        email: userEntity.email,
        fullName: userEntity.fullName,
        role: user.role,
        permissions: user.role?.isSuperAdmin ? ['*'] : permissions,
        organizations: activeMemberships.map((membership) => ({
          name: membership.organization?.name,
          slug: membership.organization?.slug,
          roleName: membership.role.role_name,
          roleCode: membership.role.role_code,
        })),
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'failed to load user context';
      this.logger.warn(`AI_USER_CONTEXT_LOAD_FAILED:${message}`);
      return user;
    }
  }
}

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/modules/user/entities/user.entity';
import { Repository } from 'typeorm';
import { AiClientService } from './ai-client.service';
import { AiImageService } from 'src/ai-image/ai-image.service';
import { AiImageContextDto } from './dto/ai-chat.dto';
import {
  AiChatHistoryMessageDto,
  AiChatMode,
  AiChatResponseDto,
} from './dto/ai-chat.dto';
import { AiAuthenticatedUser } from './optional-jwt.guard';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly aiClientService: AiClientService,
    private readonly aiImageService: AiImageService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async chat(
    prompt: string,
    mode: AiChatMode = AiChatMode.CHAT,
    user?: AiAuthenticatedUser,
    history?: AiChatHistoryMessageDto[],
    imageContext?: AiImageContextDto,
  ): Promise<AiChatResponseDto> {
    const message = prompt?.trim();
    if (!message) {
      throw new BadRequestException('Message is required');
    }

    const safeUserContext = await this.getSafeUserContext(user);

    const response = await this.aiClientService.chat(
      message,
      mode,
      safeUserContext,
      history,
      imageContext,
    );

    if (response.mode !== 'image_edit_ready') {
      return response;
    }

    if (!safeUserContext?.userId) {
      const content =
        response.locale === 'vi'
          ? 'Bạn cần đăng nhập để chỉnh sửa ảnh.'
          : 'Please sign in to edit this image.';
      return {
        ...response,
        mode: 'image_edit_authentication_required',
        sourceImageUrl: undefined,
        editInstruction: undefined,
        content,
        message: content,
      };
    }

    const imageResult = await this.aiImageService.edit({
      imageUrl: response.sourceImageUrl,
      description: response.editInstruction || message,
      ratio: imageContext?.ratio,
    });
    const content =
      response.locale === 'vi'
        ? 'Đã chỉnh sửa ảnh. Bạn có thể tiếp tục yêu cầu chỉnh sửa trên ảnh mới.'
        : 'Image edited. You can continue editing the latest image.';

    return {
      ...response,
      mode: 'image_edit_completed',
      imageResult,
      sourceImageUrl: undefined,
      editInstruction: undefined,
      content,
      message: content,
    };
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

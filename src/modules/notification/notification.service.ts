import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiResponse, Response } from 'src/common/utils/ApiResponse';
import { Notification } from './entities/notification.entity';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationDto } from './dto/notification.dto';
import { User } from '../user/entities/user.entity';
import { Organization } from '../organization/entities/organization.entity';
import { NotificationType } from 'src/shared/enum/enum';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private notificationRepo: Repository<Notification>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Organization)
    private organizationRepo: Repository<Organization>,
  ) {}

  async create(
    createNotificationDto: CreateNotificationDto,
  ): Promise<ApiResponse<NotificationDto>> {
    const user = await this.userRepo.findOne({
      where: { id: createNotificationDto.userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    let organization: Organization | null = null;
    if (createNotificationDto.organizationId) {
      organization = await this.organizationRepo.findOne({
        where: { id: createNotificationDto.organizationId },
      });

      if (!organization) {
        throw new NotFoundException('Organization not found');
      }
    }

    const notification = this.notificationRepo.create({
      user,
      organization,
      title: createNotificationDto.title,
      message: createNotificationDto.message,
      type: createNotificationDto.type || NotificationType.SYSTEM,
      metadata: createNotificationDto.metadata || null,
    });

    const savedNotification = await this.notificationRepo.save(notification);
    return Response(
      201,
      'Create notification successfully',
      this.toResponse(savedNotification),
    );
  }

  async findMyNotifications(
    userId: string,
  ): Promise<ApiResponse<NotificationDto[]>> {
    console.time(`GET_MY_NOTIFICATIONS:${userId}`);
    try {
      const notifications = await this.notificationRepo.find({
        where: { user: { id: userId } },
        relations: ['organization'],
        order: { createdAt: 'DESC' },
      });

      return Response(
        200,
        'Get notifications successfully',
        notifications.map((notification) => this.toResponse(notification)),
      );
    } finally {
      console.timeEnd(`GET_MY_NOTIFICATIONS:${userId}`);
    }
  }

  async getUnreadCount(userId: string): Promise<ApiResponse<{ total: number }>> {
    console.time(`GET_UNREAD_NOTIFICATIONS_COUNT:${userId}`);
    try {
      const total = await this.notificationRepo.count({
        where: {
          user: { id: userId },
          isRead: false,
        },
      });

      return Response(200, 'Get unread notifications count successfully', {
        total,
      });
    } finally {
      console.timeEnd(`GET_UNREAD_NOTIFICATIONS_COUNT:${userId}`);
    }
  }

  async markAsRead(
    id: string,
    userId: string,
  ): Promise<ApiResponse<NotificationDto>> {
    const notification = await this.notificationRepo.findOne({
      where: { id },
      relations: ['user', 'organization'],
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.user.id !== userId) {
      throw new ForbiddenException(
        'You do not have permission to update this notification',
      );
    }

    notification.isRead = true;
    notification.readAt = new Date();

    const savedNotification = await this.notificationRepo.save(notification);
    return Response(
      200,
      'Mark notification as read successfully',
      this.toResponse(savedNotification),
    );
  }

  async markAllAsRead(userId: string): Promise<ApiResponse<{ updated: number }>> {
    const result = await this.notificationRepo.update(
      {
        user: { id: userId },
        isRead: false,
      },
      {
        isRead: true,
        readAt: new Date(),
      },
    );

    return Response(200, 'Mark all notifications as read successfully', {
      updated: result.affected || 0,
    });
  }

  private toResponse(notification: Notification): NotificationDto {
    return {
      id: notification.id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      isRead: notification.isRead,
      readAt: notification.readAt || null,
      metadata: notification.metadata || null,
      createdAt: notification.createdAt,
      organization: notification.organization
        ? {
            id: notification.organization.id,
            name: notification.organization.name,
            slug: notification.organization.slug,
            isVerified: notification.organization.isVerified,
          }
        : null,
    };
  }
}

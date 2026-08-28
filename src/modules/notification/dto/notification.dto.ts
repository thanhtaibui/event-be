import { NotificationType } from 'src/shared/enum/enum';

export class NotificationDto {
  id: string;

  title: string;

  message: string;

  type: NotificationType;

  isRead: boolean;

  readAt?: Date | null;

  metadata?: Record<string, any> | null;

  createdAt: Date;

  organization?: {
    id: string;
    name: string;
    slug: string;
    isVerified: boolean;
  } | null;
}

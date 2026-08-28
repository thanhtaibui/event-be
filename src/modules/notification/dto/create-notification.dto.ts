import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { NotificationType } from 'src/shared/enum/enum';

export class CreateNotificationDto {
  @IsUUID('4', { message: 'User ID must be a valid UUID' })
  @IsNotEmpty({ message: 'User ID is required' })
  @ApiProperty({ example: 'userId' })
  userId: string;

  @IsUUID('4', { message: 'Organization ID must be a valid UUID' })
  @IsOptional()
  @ApiPropertyOptional({ example: 'organizationId' })
  organizationId?: string;

  @IsString()
  @IsNotEmpty({ message: 'Title is required' })
  @MaxLength(255)
  @ApiProperty({ example: 'New notification' })
  title: string;

  @IsString()
  @IsNotEmpty({ message: 'Message is required' })
  @MaxLength(1000)
  @ApiProperty({ example: 'You have a new update' })
  message: string;

  @IsEnum(NotificationType)
  @IsOptional()
  @ApiPropertyOptional({
    enum: NotificationType,
    example: NotificationType.SYSTEM,
  })
  type?: NotificationType;

  @IsObject()
  @IsOptional()
  @ApiPropertyOptional({ example: { orderId: 'orderId' } })
  metadata?: Record<string, any>;
}

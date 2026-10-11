import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';

export class CreateFeedbackDto {
  @ApiProperty({ example: '2d0a4a84-9f86-4a8c-99b1-314c5b48c8d7' })
  @IsUUID('4', { message: 'Event ID must be a valid UUID' })
  @IsNotEmpty({ message: 'Event ID is required' })
  eventId: string;

  @ApiPropertyOptional({ example: 5, minimum: 1, maximum: 5 })
  @IsOptional()
  @IsInt({ message: 'Rating must be an integer' })
  @Min(1, { message: 'Rating must be at least 1' })
  @Max(5, { message: 'Rating must be at most 5' })
  rating?: number;

  @ApiProperty({ example: 'Sự kiện tổ chức tốt, nội dung hữu ích.' })
  @IsString({ message: 'Comment must be a string' })
  @IsNotEmpty({ message: 'Comment is required' })
  @Length(5, 1000, {
    message: 'Comment must be between 5 and 1000 characters',
  })
  comment: string;
}

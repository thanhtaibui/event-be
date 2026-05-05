import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsNumber,
  Min,
  IsUUID
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EventStatus } from 'src/shared/enum/enum';

export class CreateEventDto {
  @ApiProperty({
    example: 'Workshop NestJS & Microservices',
  })
  @IsString()
  @IsNotEmpty({ message: 'Event title is required' })
  title: string;

  @ApiPropertyOptional({
    example: 'https://res.cloudinary.com/image.jpg',
  })
  @IsString()
  @IsOptional()
  eventPoster?: string;

  @ApiProperty({
    example: '2026-05-20T08:00:00Z',
  })
  @IsDateString({}, { message: 'Invalid start date format' })
  @IsNotEmpty({ message: 'Start date and time is required' })
  startDateTime: Date;

  @ApiProperty({
    example: '2026-05-20T17:00:00Z',
  })
  @IsDateString({}, { message: 'Invalid end date format' })
  @IsNotEmpty({ message: 'End date and time is required' })
  endDateTime: Date;

  @ApiProperty({
    example: '2026-05-15T23:59:59Z',
  })
  @IsDateString({}, { message: 'Invalid registration deadline format' })
  @IsNotEmpty({ message: 'Registration deadline is required' })
  registrationEndDate: Date;

  @ApiProperty({
    example: 100,
  })
  @IsNumber()
  @Min(1, { message: 'Capacity must be at least 1' })
  @IsNotEmpty({ message: 'Event capacity is required' })
  capacity: number;

  // @ApiPropertyOptional({
  //   example: 'PUBLISHED',
  //   enum: EventStatus,
  // })
  @IsString()
  @IsOptional()
  status: EventStatus;

  @ApiProperty({
    example: 'uuid',
  })
  @IsUUID('4', { message: 'Organization ID must be a valid UUID' })
  @IsNotEmpty({ message: 'Organization ID is required' })
  organizationId: string;

  @IsString()
  @IsOptional()
  @ApiProperty({ example: "description" })
  description: string;

  @IsString()
  @IsOptional()
  @ApiProperty({ example: "place" })
  place: string;
}
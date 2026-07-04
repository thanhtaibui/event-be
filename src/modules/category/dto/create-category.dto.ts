import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({
    example: 'Technology',
    description: 'Category name (unique)',
  })
  @IsString()
  @IsNotEmpty({ message: 'Category name is required' })
  @MaxLength(100, {
    message: 'Category name must be at most 100 characters long',
  })
  name: string;

  @ApiPropertyOptional({
    example: 'Category for tech-related events',
  })
  @IsString()
  @IsOptional()
  @IsNotEmpty({ message: 'Description must not be empty' })
  @MaxLength(1000, {
    message: 'Description must be at most 1000 characters long',
  })
  description?: string;
}

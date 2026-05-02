import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUrl, IsUUID, MaxLength, Matches } from "class-validator";

export class CreateOrganizationDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  @ApiProperty({
    example: 'Google Vietnam'
  })
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @ApiPropertyOptional({
    example: 'Leading technology company in Southeast Asia'
  })
  bio?: string;

  @IsString()
  @IsOptional()
  @ApiPropertyOptional({
    example: 'Google Vietnam Company Limited'
  })
  legalName?: string;

  @IsString()
  @IsOptional()
  @ApiPropertyOptional({
    example: 'Technology',
    // enum: ['Technology', 'Education', 'Healthcare', 'Finance', 'Other'] 
  })
  industry: string;

  @IsString()
  @IsOptional()
  @ApiPropertyOptional({
    example: '123 District 1, Ho Chi Minh City, Vietnam'
  })
  address?: string;

  @IsEmail({}, { message: 'Invalid primary email format' })
  @IsOptional()
  @ApiPropertyOptional({
    example: 'contact@google.com.vn'
  })
  email?: string;

  @IsString()
  @IsOptional()
  @ApiPropertyOptional({
    example: '+84901234567'
  })
  phone?: string;

  @IsUrl({}, { message: 'Invalid website URL' })
  @IsOptional()
  @ApiPropertyOptional({
    example: 'https://google.com.vn'
  })
  website?: string;

  @IsNotEmpty()
  @IsUUID()
  @ApiProperty({
    example: 'uuid'
  })
  ownerId: string;

  @IsNotEmpty()
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'Slug must be kebab-case' })
  @ApiProperty({
    example: 'google-vietnam'
  })
  slug: string;
}
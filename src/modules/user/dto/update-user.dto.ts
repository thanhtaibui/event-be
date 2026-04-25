import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';
import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsEnum, IsArray, ValidateNested, IsNotEmpty } from "class-validator";
import { IsString } from "class-validator";
import { CreateMembershipDto } from 'src/modules/membership/dto/create-membership.dto';
import { Type } from 'class-transformer';

export class UpdateUserDto extends PartialType(CreateUserDto) {

  @IsString({ message: 'Full name must be a string' })
  @IsNotEmpty()
  @ApiProperty({ example: "Bui Tai A" })
  fullName: string;

  @IsOptional()
  @IsString({ message: 'Phone number must be a string' })
  @ApiProperty({ example: "0123456789", required: false })
  phoneNumber?: string

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMembershipDto)
  @ApiProperty({
    type: [CreateMembershipDto],
    required: false,
    description: 'list org & role'
  })
  memberships?: CreateMembershipDto[];

}

export class UpdateUserResDto {
  fullName?: string;
  phoneNumber?: string
  memberships?: CreateMembershipDto[];

}


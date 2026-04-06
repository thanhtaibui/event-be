import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';
import { ApiProperty } from "@nestjs/swagger";
import { IsOptional } from "class-validator";
import { IsString } from "class-validator";
export class UpdateUserDto extends PartialType(CreateUserDto) {

    @IsString({ message: 'Full name must be a string' })
    @ApiProperty({ example: "Bui Tai A" })
    fullName: string;

    @IsOptional()
    @IsString({ message: 'Phone number must be a string' })
    @ApiProperty({ example: "0123456789", required: false })
    phoneNumber?: Number

    @IsOptional()
    @IsString({ message: 'Bio must be a string' })
    @ApiProperty({ example: "This is my bio", required: false })
    bio?: string;

}

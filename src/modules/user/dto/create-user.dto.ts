import { ApiProperty } from "@nestjs/swagger";
import { IsOptional } from "class-validator";
import { IsEmail, IsString } from "class-validator";
import { Matches } from "class-validator";
export class CreateUserDto {
    @IsEmail({}, { message: 'Invalid email format' })
    @ApiProperty({ example: "buitaia9@gmail.com" })
    email: string;

    @IsString({ message: 'Password must be a string' })
    @Matches(/^[a-zA-Z0-9]{6,}$/, {
        message:
            'Password must be at least 6 characters long and contain only letters and numbers',
    })
    @ApiProperty({ example: "Password123" })
    password: string

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

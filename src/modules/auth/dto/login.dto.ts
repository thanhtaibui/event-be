import { IsEmail, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
export class LoginDto {
    @IsEmail({}, { message: 'Invalid email format' })
    @ApiProperty({ example: 'buitaia9@gmail.com' })
    email: string;

    @IsString()
    @ApiProperty({ example: 'Password123' })
    password: string;
}
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEmail, IsString } from 'class-validator';

export class checkEmailDto {
  @ApiProperty({
    example: ['valid@gmail.com', 'already@gmail.com', 'bad-email'],
    type: [String],
  })
  @IsArray()
  // @IsEmail({}, { each: true })
  emails: string[];

  @ApiProperty({
    example: 'uuid',
  })
  @IsString()
  eventId: string;
}
export class checkEmailResDto {
  email: string;

  status: string;
}

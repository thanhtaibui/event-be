import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString } from "class-validator";

export class CreateInviteDto {
  @IsEmail({}, { each: true })
  @ApiProperty({
    example: ['email@gmail.com'],
  })
  emailInvite: string[];

  @ApiProperty({
    example: 'uuid',
  })
  @IsString()
  eventId: string;

  @IsString()
  @ApiProperty({
    example: 'You are invited to join the event!',
    required: false,
  })
  message?: string;
}

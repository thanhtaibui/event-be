import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class AiChatDto {
  @ApiProperty({
    example: 'Tạo ý tưởng khai trương cửa hàng điện thoại',
  })
  @IsString()
  @MaxLength(3000)
  message: string;
}

export class AiChatResponseDto {
  type: 'text';
  message: string;
}

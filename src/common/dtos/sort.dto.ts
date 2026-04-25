import { IsString, IsIn, IsOptional } from 'class-validator';
import { PaginationRequestDto } from './pagination_req.dto';
import { ApiPropertyOptional } from '@nestjs/swagger'; // Import cái này
export class SortDto extends PaginationRequestDto {

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  // @IsOptional()
  @ApiPropertyOptional()
  @IsOptional()
  sortBy?: string;

  // @IsOptional()
  @ApiPropertyOptional({ enum: ['asc', 'desc', 'ASC', 'DESC'], default: 'asc' })
  @IsIn(['asc', 'desc', 'ASC', 'DESC'])
  @IsOptional()
  sortOrder?: 'asc' | 'desc' | 'ASC' | 'DESC' = 'asc';
}
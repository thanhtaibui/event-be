import { Type } from 'class-transformer';
import { IsInt, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';

export class PaginationRequestDto {
    @ApiPropertyOptional({ example: 1 })
    @Type(() => Number)
    @IsInt()
    @Min(1)
    // @IsOptional()
    page: number = 1;

    @ApiPropertyOptional({ example: 10 })
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    // @IsOptional()
    limit: number = 10;
}
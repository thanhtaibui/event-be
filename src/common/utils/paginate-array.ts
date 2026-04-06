import { PaginationRequestDto } from '../dtos/pagination_req.dto';
import { PaginationResult } from '../dtos/pagination.type';

export function paginateArray<T>(
    data: T[],
    page_item: PaginationRequestDto,
): PaginationResult<T> {
    const { page, limit } = page_item;

    const total = data.length;
    const start = (page - 1) * limit;
    const end = start + limit;

    const items = data.slice(start, end);

    return {
        items,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
    };
}
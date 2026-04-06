export type PaginationResult<T> = {
    items: T[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
};
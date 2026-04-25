import { BadRequestException } from '@nestjs/common';

export function applySort<T>(
  data: T[],
  sortBy?: keyof T,
  sortOrder: 'asc' | 'desc' | 'ASC' | 'DESC' = 'asc',
  allowedFields: (keyof T)[] = []
): T[] {
  //  Không có sortBy → không sort
  if (!sortBy) return data;

  //  Có nhưng sai → báo lỗi
  if (allowedFields.length && !allowedFields.includes(sortBy)) {
    throw new BadRequestException(`Invalid sortBy: ${String(sortBy)}`);
  }

  const order = sortOrder.toLowerCase();

  return data.sort((a, b) => {
    const aValue = a[sortBy];
    const bValue = b[sortBy];

    //  handle null / undefined
    if (aValue == null && bValue == null) return 0;
    if (aValue == null) return 1;
    if (bValue == null) return -1;

    //string
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return order === 'asc'
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }

    //  number / boolean / date
    if (aValue > bValue) return order === 'asc' ? 1 : -1;
    if (aValue < bValue) return order === 'asc' ? -1 : 1;

    return 0;
  });
}

export function applySearch<T>(
  data: T[],
  search?: string,
  searchFields: string[] = []
): T[] {

  if (!search || searchFields.length === 0) return data;

  const searchTerm = search.toLowerCase();

  return data.filter((item) => {
    return searchFields.some((field) => {
      const value = field.split('.').reduce((obj, key) => obj?.[key], item as any);

      return String(value).toLowerCase().includes(searchTerm);
    });
  });
}
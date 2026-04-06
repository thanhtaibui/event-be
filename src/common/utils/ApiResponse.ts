import { HttpException } from '@nestjs/common';

export interface ApiResponse<T> {
    statusCode: number;
    message: string;
    data: T | null;
}


export function Response<T>(
    statusCode: number,
    message: string,
    data: T | null = null,
): ApiResponse<T> {
    if (statusCode >= 400) {
        throw new HttpException(
            {
                statusCode,
                message,
                data: null,
            },
            statusCode,
        );
    }

    return {
        statusCode,
        message,
        data,
    };
}
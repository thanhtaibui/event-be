import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
} from '@nestjs/common';

@Catch() // bắt ALL lỗi luôn
export class AllExceptionFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();

        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let message = 'Internal server error';

        // nếu là lỗi từ Nest (throw new NotFoundException...)
        if (exception instanceof HttpException) {
            status = exception.getStatus();

            const res: any = exception.getResponse();

            message = res?.message || res || 'Error';
        }

        // lỗi thường (code bug, undefined, crash...)
        else if (exception instanceof Error) {
            message = exception.message;
        }

        response.status(status).json({
            statusCode: status,
            message,
            data: null,
        });
    }
}
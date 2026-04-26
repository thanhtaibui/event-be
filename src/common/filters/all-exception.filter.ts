import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

@Catch()
export class AllExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: any = 'Internal server error';

    // 1. Xử lý lỗi Unique Database (ưu tiên kiểm tra code trước)
    if (exception.code === '23505' || exception.errno === 1062) {
      status = HttpStatus.CONFLICT;
      const detail = exception.detail;
      if (detail?.includes('role_code')) {
        message = 'This Role Code already exists. Please choose a different one.';
      } else if (detail?.includes('role_name')) {
        message = 'This Role Name is already taken.';
      } else {
        message = 'Duplicate data detected. Please check your input and try again.';
      }
    }
    // 2. Xử lý lỗi HttpException (Validation, NotFound, Unauthorized...)
    else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res: any = exception.getResponse();

      // Quan trọng: res.message thường là một mảng đối với lỗi Validation
      // Chúng ta lấy phần tử đầu tiên nếu là mảng, nếu không thì lấy res.message hoặc chính res
      const resMessage = res?.message || res;
      message = Array.isArray(resMessage) ? resMessage[0] : resMessage;
    }
    // 3. Lỗi hệ thống khác (Runtime Error)
    else if (exception instanceof Error) {
      message = exception.message;
    }

    // Gửi response duy nhất một lần ở cuối
    return response.status(status).json({
      statusCode: status,
      message: message,
      data: null,
    });
  }
}
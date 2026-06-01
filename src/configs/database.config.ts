import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const databaseConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  url: process.env.DATABASE_URL,  // ví dụ: postgres://postgres:123456@postgres:5432/event_db
  synchronize: true,
  ssl: {
    rejectUnauthorized: false, // Cần thiết để bỏ qua kiểm tra chứng chỉ tự ký của AWS
  },
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
};

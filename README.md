# Giới thiệu Công nghệ sử dụng
  NestJS (Node.js framework)
  TypeScript
  PostgreSQL
  TypeORM
  Docker

<!-- các bước chạy dự án -->
# 1. clone project 
  https://github.com/thanhtaibui/event-be.git
  cd event-be
# 2. cài đặt dependency
  npm install
# 3. tạo file .env
  # Docker dùng
  POSTGRES_DB=event_db
  POSTGRES_USER=postgres
  POSTGRES_PASSWORD=123456

  # Backend dùng
  DB_HOST=localhost
  DB_PORT=5432
  DB_USERNAME=postgres
  DB_PASSWORD=123456
  DB_NAME=event_db
# 4. chạy docker(terminal)
  docker-compose up -d
# 5. chạy server 
  npm run start
# 6

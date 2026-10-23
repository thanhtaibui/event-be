import { TypeOrmModuleOptions } from '@nestjs/typeorm';

const getNumberEnv = (key: string, defaultValue: number): number => {
  const value = Number(process.env[key]);
  return Number.isFinite(value) && value > 0 ? value : defaultValue;
};

export const databaseConfig = (): TypeOrmModuleOptions => {
  const isProduction = process.env.NODE_ENV === 'production';
  const databaseUrl = process.env.DATABASE_URL;
  const requiresSsl =
    isProduction ||
    process.env.DB_SSL === 'true' ||
    Boolean(
      databaseUrl &&
        (databaseUrl.includes('sslmode=require') ||
          databaseUrl.includes('neon.tech')),
    );

  const poolExtra = {
    max: getNumberEnv('DB_POOL_MAX', 10),
    idleTimeoutMillis: getNumberEnv('DB_IDLE_TIMEOUT_MS', 30000),
    connectionTimeoutMillis: getNumberEnv('DB_CONNECTION_TIMEOUT_MS', 5000),
  };

  const baseConfig: TypeOrmModuleOptions = {
    type: 'postgres',
    synchronize: process.env.DB_SYNC === 'true',
    migrationsRun: process.env.DB_MIGRATIONS_RUN === 'true',
    migrations: [__dirname + '/../migrations/*{.ts,.js}'],
    logging:
      process.env.DB_LOGGING === 'true'
        ? ['error', 'warn', 'schema']
        : ['error'],
    maxQueryExecutionTime: getNumberEnv('DB_SLOW_QUERY_MS', 200),
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    extra: poolExtra,
  };

  if (databaseUrl) {
    return {
      ...baseConfig,
      url: databaseUrl,
      ssl: requiresSsl
        ? {
            rejectUnauthorized: false,
          }
        : false,
    };
  }

  return {
    ...baseConfig,
    host: process.env.DB_HOST || process.env.POSTGRES_HOST || 'localhost',
    port: Number(process.env.DB_PORT || process.env.POSTGRES_PORT || 5432),
    username: process.env.DB_USERNAME || process.env.POSTGRES_USER,
    password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD,
    database: process.env.DB_NAME || process.env.POSTGRES_DB,
    ssl: requiresSsl
      ? {
          rejectUnauthorized: false,
        }
      : false,
  };
};

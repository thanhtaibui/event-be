import { DataSource, DataSourceOptions } from 'typeorm';
import { databaseConfig } from './configs/database.config';

export const AppDataSource = new DataSource(
  databaseConfig() as DataSourceOptions,
);

import 'reflect-metadata';
import { DataSource } from 'typeorm';
import dotenv from 'dotenv';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: Number.parseInt(process.env.POSTGRES_PORT || '5432', 10),
  username: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  database: process.env.POSTGRES_DB || 'bidy_db',
  synchronize: process.env.NODE_ENV !== 'production', // Auto create schema in dev
  logging: process.env.DEBUG === 'true',
  entities: [
    __dirname + '/../modules/**/*.entity.ts',
  ],
  migrations: [__dirname + '/../database/migrations/*.ts'],
});

export const initializeDatabase = async () => {
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      console.log('PostgreSQL DataSource initialized successfully via TypeORM.');
    }
  } catch (error) {
    console.error('Error during Data Source initialization:', error);
    throw error;
  }
};

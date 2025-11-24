import mysql from 'mysql2/promise';
import { RowDataPacket, QueryResult as MySQLQueryResult } from 'mysql2';
import { QueryParams } from '@/types';

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'bluebeam_prototype',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

let pool: mysql.Pool | null = null;

export function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool(dbConfig);
  }
  return pool;
}

export async function query<T extends RowDataPacket = RowDataPacket>(
  sql: string,
  params?: QueryParams
): Promise<T[]> {
  const connection = await getPool().getConnection();
  try {
    const [results] = await connection.execute<MySQLQueryResult>(sql, params);
    return results as T[];
  } finally {
    connection.release();
  }
}

export async function transaction<T>(callback: (connection: mysql.PoolConnection) => Promise<T>): Promise<T> {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}




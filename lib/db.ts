import mysql from 'mysql2/promise';

const dbConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3306', 10),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'empenho',
  waitForConnections: true,
  connectionLimit: 1, // coloquei 1 pra nao explodir conexoes no XAMPP
  queueLimit: 0,
  timezone: '-03:00',
};

// se nao fizer isso o next.js cria um pool novo a cada hot-reload e estoura conexoes
declare global {
  var _mysqlPool: mysql.Pool | undefined;
}

export const pool = globalThis._mysqlPool || mysql.createPool({ ...dbConfig, connectionLimit: 3 });
if (process.env.NODE_ENV !== 'production') {
  globalThis._mysqlPool = pool;
}

export async function query<T = any>(sql: string, values?: any[]): Promise<T> {
  const [results] = await pool.query(sql, values);
  return results as T;
}

export async function withTransaction<T>(
  fn: (conn: mysql.PoolConnection) => Promise<T>
): Promise<T> {
  const conn = await pool.getConnection();
  if (conn.beginTransaction) await conn.beginTransaction();
  try {
    const result = await fn(conn);
    if (conn.commit) await conn.commit();
    return result;
  } catch (err) {
    if (conn.rollback) await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

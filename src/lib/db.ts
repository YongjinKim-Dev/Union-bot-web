import mysql from "mysql2/promise";

declare global {
  var __dbPool: mysql.Pool | undefined;
}

function createPool() {
  return mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    charset: "utf8mb4",
    timezone: "+09:00",
    supportBigNumbers: true,
    bigNumberStrings: true,
    connectionLimit: 10,
    waitForConnections: true,
  });
}

// Reuse the pool across hot reloads / route invocations instead of opening a
// new one per request, mirroring the PooledDB setup in the Discord bot.
export const pool = globalThis.__dbPool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  globalThis.__dbPool = pool;
}

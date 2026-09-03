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
    // 투표가 열리는 순간 150명이 한꺼번에 들어온다. 10 개로는 줄이 길어져
    // 마지막 사람이 5 초 가까이 기다렸다. 봇이 최대 10 개를 쓰고 MySQL
    // max_connections 가 151 이라 30 은 넉넉히 들어간다.
    connectionLimit: 30,
    waitForConnections: true,
  });
}

// Reuse the pool across hot reloads / route invocations instead of opening a
// new one per request, mirroring the PooledDB setup in the Discord bot.
export const pool = globalThis.__dbPool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  globalThis.__dbPool = pool;
}

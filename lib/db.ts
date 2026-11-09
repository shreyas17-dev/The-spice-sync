// MySQL access. One connection pool per role, each logged in with that role's own
// MySQL account (database/06_roles.sql), so MySQL itself enforces what a role may do.
import mysql from "mysql2/promise";

export type Role = "customer" | "owner" | "partner" | "admin";

const ACCOUNT: Record<Role, [string, string | undefined]> = {
  customer: ["fd_app_customer", process.env.DB_PASS_CUSTOMER],
  owner: ["fd_app_owner", process.env.DB_PASS_OWNER],
  partner: ["fd_app_partner", process.env.DB_PASS_PARTNER],
  admin: ["fd_app_admin", process.env.DB_PASS_ADMIN],
};

const g = globalThis as any;

function makePool(role: Role) {
  const [user, password] = ACCOUNT[role];
  return mysql.createPool({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    database: process.env.DB_NAME || "food_delivery",
    user,
    password,
    connectionLimit: 8,
    dateStrings: true,       // DATETIME comes back as 'YYYY-MM-DD HH:MM:SS'
    decimalNumbers: true,    // DECIMAL comes back as a number
    multipleStatements: false,
    charset: "utf8mb4",
  });
}

export function db(role: Role): mysql.Pool {
  if (!g.__br_pools) g.__br_pools = {};
  if (!g.__br_pools[role]) g.__br_pools[role] = makePool(role);
  return g.__br_pools[role];
}

/** Run a query with ? placeholders and return the rows. */
export async function q<T = any>(role: Role, sql: string, params: any[] = []): Promise<T[]> {
  const [rows] = await db(role).query(sql, params);
  return rows as T[];
}

/** First row or null. */
export async function one<T = any>(role: Role, sql: string, params: any[] = []): Promise<T | null> {
  const rows = await q<T>(role, sql, params);
  return rows.length ? rows[0] : null;
}

/** INSERT / UPDATE / DELETE: returns { insertId, affectedRows }. */
export async function exec(role: Role, sql: string, params: any[] = []) {
  const [res] = await db(role).query(sql, params);
  return res as { insertId: number; affectedRows: number };
}

/**
 * CALL a procedure that has OUT parameters. `callSql` uses @variables for the OUT
 * parameters and `outSql` reads them back on the same connection, e.g.
 *   callOut("customer", "CALL sp_place_order(?,?,?,?,?,?,?,@oid)", [...], "SELECT @oid AS oid")
 */
export async function callOut<T = any>(role: Role, callSql: string, params: any[], outSql: string): Promise<T> {
  const conn = await db(role).getConnection();
  try {
    await conn.query(callSql, params);
    const [rows] = await conn.query(outSql);
    return (rows as any[])[0] as T;
  } finally {
    conn.release();
  }
}

/** CALL a procedure that returns result sets; gives back the list of result sets. */
export async function callSets(role: Role, callSql: string, params: any[] = []): Promise<any[][]> {
  const [res] = await db(role).query(callSql, params);
  return (res as any[]).filter((x) => Array.isArray(x));
}

import type { Sql } from "postgres";
import { createDatabaseClient } from "./database";

export type UserRole = "admin" | "operator" | "reviewer";

export type AppUser = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  active: boolean;
  pictureUrl: string | null;
};

export type ManagedUser = AppUser & {
  lastLoginAt: string | null;
  createdAt: string;
};

type UserRow = {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  active: boolean;
  picture_url: string | null;
  last_login_at?: Date | string | null;
  created_at?: Date | string;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function toIso(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapUser(row: UserRow): AppUser {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    active: row.active,
    pictureUrl: row.picture_url,
  };
}

async function ensureInitialAdmin(sql: Sql, email: string) {
  const initialAdminEmail = normalizeEmail(
    process.env.INITIAL_ADMIN_EMAIL || "semobicn.ia@gmail.com",
  );
  if (email !== initialAdminEmail) return;

  await sql`
    insert into app_users (email, full_name, role)
    values (
      ${initialAdminEmail},
      'Administrador SEMOBICN IA',
      'admin'
    )
    on conflict do nothing
  `;
}

export async function findAuthorizedUser(
  emailValue: string | null | undefined,
): Promise<AppUser | null> {
  if (!emailValue) return null;
  const email = normalizeEmail(emailValue);
  const sql = createDatabaseClient();
  if (!sql) return null;

  try {
    await ensureInitialAdmin(sql, email);
    const [row] = await sql<UserRow[]>`
      select id, email, full_name, role, active, picture_url
      from app_users
      where lower(email) = ${email}
      limit 1
    `;
    if (!row?.active) return null;
    return mapUser(row);
  } finally {
    await sql.end();
  }
}

export async function recordSuccessfulLogin(input: {
  email: string;
  fullName?: string | null;
  pictureUrl?: string | null;
}) {
  const sql = createDatabaseClient();
  if (!sql) return;
  const email = normalizeEmail(input.email);

  try {
    await sql`
      update app_users
      set
        full_name = coalesce(nullif(${input.fullName?.trim() || null}, ''), full_name),
        picture_url = coalesce(${input.pictureUrl || null}, picture_url),
        last_login_at = now(),
        updated_at = now()
      where lower(email) = ${email}
        and active
    `;
  } finally {
    await sql.end();
  }
}

export async function listManagedUsers(): Promise<ManagedUser[]> {
  const sql = createDatabaseClient();
  if (!sql) return [];

  try {
    const rows = await sql<UserRow[]>`
      select
        id,
        email,
        full_name,
        role,
        active,
        picture_url,
        last_login_at,
        created_at
      from app_users
      order by active desc, full_name, email
    `;
    return rows.map((row) => ({
      ...mapUser(row),
      lastLoginAt: toIso(row.last_login_at),
      createdAt: toIso(row.created_at) || new Date(0).toISOString(),
    }));
  } finally {
    await sql.end();
  }
}

export async function createManagedUser(input: {
  email: string;
  fullName: string;
  role: UserRole;
}): Promise<ManagedUser> {
  const email = normalizeEmail(input.email);
  const fullName = input.fullName.trim();
  if (!email || !email.includes("@") || !fullName) {
    throw new Error("INVALID_USER");
  }

  const sql = createDatabaseClient();
  if (!sql) throw new Error("DATABASE_UNAVAILABLE");

  try {
    const [row] = await sql<UserRow[]>`
      insert into app_users (email, full_name, role)
      values (${email}, ${fullName}, ${input.role})
      returning
        id,
        email,
        full_name,
        role,
        active,
        picture_url,
        last_login_at,
        created_at
    `;
    return {
      ...mapUser(row),
      lastLoginAt: toIso(row.last_login_at),
      createdAt: toIso(row.created_at) || new Date().toISOString(),
    };
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505"
    ) {
      throw new Error("EMAIL_EXISTS");
    }
    throw error;
  } finally {
    await sql.end();
  }
}

export async function updateManagedUser(input: {
  id: string;
  currentUserId: string;
  fullName: string;
  role: UserRole;
  active: boolean;
}): Promise<ManagedUser> {
  if (input.id === input.currentUserId && (!input.active || input.role !== "admin")) {
    throw new Error("CANNOT_CHANGE_SELF_ACCESS");
  }

  const fullName = input.fullName.trim();
  if (!fullName) throw new Error("INVALID_USER");

  const sql = createDatabaseClient();
  if (!sql) throw new Error("DATABASE_UNAVAILABLE");

  try {
    const [row] = await sql<UserRow[]>`
      update app_users
      set
        full_name = ${fullName},
        role = ${input.role},
        active = ${input.active},
        updated_at = now()
      where id = ${input.id}::uuid
      returning
        id,
        email,
        full_name,
        role,
        active,
        picture_url,
        last_login_at,
        created_at
    `;
    if (!row) throw new Error("USER_NOT_FOUND");
    return {
      ...mapUser(row),
      lastLoginAt: toIso(row.last_login_at),
      createdAt: toIso(row.created_at) || new Date().toISOString(),
    };
  } finally {
    await sql.end();
  }
}

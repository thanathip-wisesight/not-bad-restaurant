import { sql } from "drizzle-orm";
import {
  check,
  integer,
  jsonb,
  pgEnum,
  pgSequence,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { CATEGORIES, ITEM_STATUSES } from "../lib/domain";

export const categoryEnum = pgEnum("category", CATEGORIES);
export const sessionStatusEnum = pgEnum("session_status", ["open", "paid", "voided"]);
export const itemStatusEnum = pgEnum("item_status", ITEM_STATUSES);

export const billSeq = pgSequence("bill_seq");

export const branches = pgTable("branches", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
});

// A table's branch is the only place branch is stored; sessions, carts and orders reach it via the table (D1).
export const tables = pgTable(
  "tables",
  {
    id: serial("id").primaryKey(),
    branchId: integer("branch_id")
      .notNull()
      .references(() => branches.id),
    number: integer("number").notNull(),
  },
  (t) => [unique("tables_branch_number_unique").on(t.branchId, t.number)],
);

export const menuItems = pgTable("menu_items", {
  id: serial("id").primaryKey(),
  category: categoryEnum("category").notNull(),
  sort: integer("sort").notNull(),
  nameTh: text("name_th").notNull(),
  nameEn: text("name_en").notNull(),
  price: integer("price").notNull(),
  imageUrl: text("image_url"),
});

export const menuOptions = pgTable("menu_options", {
  id: serial("id").primaryKey(),
  menuItemId: integer("menu_item_id").notNull().references(() => menuItems.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  priceDelta: integer("price_delta").notNull(),
});

// TableSession and Bill are 1:1, so one row (design D3).
export const tableSessions = pgTable(
  "table_sessions",
  {
    id: serial("id").primaryKey(),
    tableId: integer("table_id").notNull().references(() => tables.id),
    billNo: text("bill_no").notNull().unique(),
    status: sessionStatusEnum("status").notNull().default("open"),
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("one_open_session_per_table").on(t.tableId).where(sql`${t.status} = 'open'`)],
);

export const cartLines = pgTable(
  "cart_lines",
  {
    id: serial("id").primaryKey(),
    sessionId: integer("session_id").notNull().references(() => tableSessions.id),
    deviceId: uuid("device_id").notNull(),
    menuItemId: integer("menu_item_id").notNull().references(() => menuItems.id),
    optionIds: integer("option_ids").array().notNull().default(sql`'{}'`),
    note: text("note").notNull().default(""),
    qty: integer("qty").notNull(),
  },
  (t) => [check("qty_positive", sql`${t.qty} >= 1`)],
);

export const tickets = pgTable("tickets", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => tableSessions.id),
  deviceId: uuid("device_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type OptionSnapshot = { name: string; priceDelta: number };

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull().references(() => tickets.id),
  sessionId: integer("session_id").notNull().references(() => tableSessions.id),
  menuItemId: integer("menu_item_id").notNull().references(() => menuItems.id),
  nameSnapshot: text("name_snapshot").notNull(),
  optionsSnapshot: jsonb("options_snapshot").$type<OptionSnapshot[]>().notNull(),
  note: text("note").notNull().default(""),
  unitPrice: integer("unit_price").notNull(),
  status: itemStatusEnum("status").notNull().default("pending"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------- staff access (console-access spec, D5) ----------

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
});

export const userBranches = pgTable(
  "user_branches",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    branchId: integer("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.branchId] })],
);

// Only the SHA-256 of the cookie token is stored.
export const staffSessions = pgTable("staff_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

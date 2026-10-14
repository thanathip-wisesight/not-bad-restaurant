import { sql } from "drizzle-orm";
import {
  check,
  integer,
  jsonb,
  pgEnum,
  pgSequence,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { CATEGORIES, ITEM_STATUSES } from "../lib/domain";

export const categoryEnum = pgEnum("category", CATEGORIES);
export const sessionStatusEnum = pgEnum("session_status", ["open", "paid", "voided"]);
export const itemStatusEnum = pgEnum("item_status", ITEM_STATUSES);

export const billSeq = pgSequence("bill_seq");

export const tables = pgTable("tables", {
  id: serial("id").primaryKey(),
  number: integer("number").notNull().unique(),
});

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

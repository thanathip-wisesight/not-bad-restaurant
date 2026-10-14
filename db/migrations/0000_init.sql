CREATE TYPE "public"."category" AS ENUM('main', 'a_la_carte', 'soup', 'special', 'dessert', 'drink');--> statement-breakpoint
CREATE TYPE "public"."item_status" AS ENUM('pending', 'cancel_requested', 'in_progress', 'served', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('open', 'paid', 'voided');--> statement-breakpoint
CREATE SEQUENCE "public"."bill_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "cart_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"device_id" uuid NOT NULL,
	"menu_item_id" integer NOT NULL,
	"option_ids" integer[] DEFAULT '{}' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"qty" integer NOT NULL,
	CONSTRAINT "qty_positive" CHECK ("cart_lines"."qty" >= 1)
);
--> statement-breakpoint
CREATE TABLE "menu_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"category" "category" NOT NULL,
	"sort" integer NOT NULL,
	"name_th" text NOT NULL,
	"name_en" text NOT NULL,
	"price" integer NOT NULL,
	"image_url" text
);
--> statement-breakpoint
CREATE TABLE "menu_options" (
	"id" serial PRIMARY KEY NOT NULL,
	"menu_item_id" integer NOT NULL,
	"name" text NOT NULL,
	"price_delta" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" integer NOT NULL,
	"session_id" integer NOT NULL,
	"menu_item_id" integer NOT NULL,
	"name_snapshot" text NOT NULL,
	"options_snapshot" jsonb NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"unit_price" integer NOT NULL,
	"status" "item_status" DEFAULT 'pending' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "table_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"table_id" integer NOT NULL,
	"bill_no" text NOT NULL,
	"status" "session_status" DEFAULT 'open' NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	CONSTRAINT "table_sessions_bill_no_unique" UNIQUE("bill_no")
);
--> statement-breakpoint
CREATE TABLE "tables" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" integer NOT NULL,
	CONSTRAINT "tables_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"device_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cart_lines" ADD CONSTRAINT "cart_lines_session_id_table_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."table_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_lines" ADD CONSTRAINT "cart_lines_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_options" ADD CONSTRAINT "menu_options_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_session_id_table_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."table_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_sessions" ADD CONSTRAINT "table_sessions_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_session_id_table_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."table_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "one_open_session_per_table" ON "table_sessions" USING btree ("table_id") WHERE "table_sessions"."status" = 'open';
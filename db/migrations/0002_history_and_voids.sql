CREATE TYPE "public"."event_actor" AS ENUM('customer', 'staff', 'system');--> statement-breakpoint
ALTER TYPE "public"."item_status" ADD VALUE 'voided';--> statement-breakpoint
ALTER TYPE "public"."item_status" ADD VALUE 'finished';--> statement-breakpoint
CREATE TABLE "order_item_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"order_item_id" integer NOT NULL,
	"from_status" "item_status",
	"to_status" "item_status" NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"actor" "event_actor" NOT NULL,
	"staff_user_id" integer,
	"device_id" uuid,
	"note" text
);
--> statement-breakpoint
ALTER TABLE "order_item_events" ADD CONSTRAINT "order_item_events_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item_events" ADD CONSTRAINT "order_item_events_staff_user_id_users_id_fk" FOREIGN KEY ("staff_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_item_events_item_at" ON "order_item_events" USING btree ("order_item_id","at");
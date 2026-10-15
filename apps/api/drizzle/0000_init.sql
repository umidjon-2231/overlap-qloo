CREATE TABLE "activations" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"run_id" uuid NOT NULL,
	"city" text NOT NULL,
	"place_entity_id" text NOT NULL,
	"place_name" text NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"distance_m" double precision,
	"idea" text,
	"evidence" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bakeoff_results" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"preset" text NOT NULL,
	"model" text NOT NULL,
	"effort" text,
	"toolset" text NOT NULL,
	"run_id" uuid,
	"metrics" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brand_matches" (
	"run_id" uuid NOT NULL,
	"brand_entity_id" text NOT NULL,
	"brand_name" text NOT NULL,
	"category" text,
	"source" text NOT NULL,
	"affinity" double precision,
	"popularity" double precision,
	"overlap_score" double precision,
	"evidence" jsonb NOT NULL,
	"agent_note" text,
	CONSTRAINT "brand_matches_run_id_brand_entity_id_pk" PRIMARY KEY("run_id","brand_entity_id")
);
--> statement-breakpoint
CREATE TABLE "city_cells" (
	"run_id" uuid NOT NULL,
	"brand_entity_id" text NOT NULL,
	"city" text NOT NULL,
	"affinity" double precision,
	"rank_in_city" integer,
	"coverage" text NOT NULL,
	CONSTRAINT "city_cells_run_id_brand_entity_id_city_pk" PRIMARY KEY("run_id","brand_entity_id","city")
);
--> statement-breakpoint
CREATE TABLE "city_profiles" (
	"run_id" uuid NOT NULL,
	"city" text NOT NULL,
	"hotspot" jsonb,
	"cell_count" integer,
	"coverage" text NOT NULL,
	"crowd_profile" text,
	"evidence" jsonb NOT NULL,
	CONSTRAINT "city_profiles_run_id_city_pk" PRIMARY KEY("run_id","city")
);
--> statement-breakpoint
CREATE TABLE "pitch_packs" (
	"run_id" uuid NOT NULL,
	"brand_entity_id" text NOT NULL,
	"body_md" text NOT NULL,
	"approved" boolean DEFAULT false NOT NULL,
	"approved_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pitch_packs_run_id_brand_entity_id_pk" PRIMARY KEY("run_id","brand_entity_id")
);
--> statement-breakpoint
CREATE TABLE "qloo_cache" (
	"request_hash" text PRIMARY KEY NOT NULL,
	"response" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "run_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"run_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "run_events_run_id_seq_unique" UNIQUE("run_id","seq")
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_type" text NOT NULL,
	"property_name" text NOT NULL,
	"artists" jsonb NOT NULL,
	"cities" text[] NOT NULL,
	"categories" text[] NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"model" text,
	"agent_state" jsonb,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tool_calls" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"run_id" uuid,
	"tool" text NOT NULL,
	"request_redacted" jsonb NOT NULL,
	"status" text NOT NULL,
	"result_summary" jsonb,
	"duration_ms" integer,
	"cached" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activations" ADD CONSTRAINT "activations_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bakeoff_results" ADD CONSTRAINT "bakeoff_results_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_matches" ADD CONSTRAINT "brand_matches_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "city_cells" ADD CONSTRAINT "city_cells_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "city_profiles" ADD CONSTRAINT "city_profiles_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitch_packs" ADD CONSTRAINT "pitch_packs_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_events" ADD CONSTRAINT "run_events_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_calls" ADD CONSTRAINT "tool_calls_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;
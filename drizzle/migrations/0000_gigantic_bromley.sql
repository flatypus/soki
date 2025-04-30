CREATE TABLE "kanji" (
	"id" serial PRIMARY KEY NOT NULL,
	"character" text NOT NULL,
	"is_common" boolean NOT NULL,
	"readings" jsonb NOT NULL,
	"senses" text[] NOT NULL,
	"frequency" integer,
	"stroke_count" integer,
	"jlpt_level" integer,
	"grade" integer,
	CONSTRAINT "kanji_character_unique" UNIQUE("character")
);
--> statement-breakpoint
CREATE TABLE "phrase_components" (
	"phrase_id" integer NOT NULL,
	"kanji_id" integer NOT NULL,
	CONSTRAINT "phrase_components_phrase_id_kanji_id_pk" PRIMARY KEY("phrase_id","kanji_id")
);
--> statement-breakpoint
CREATE TABLE "phrases" (
	"id" serial PRIMARY KEY NOT NULL,
	"phrase" text NOT NULL,
	"is_common" boolean NOT NULL,
	"jlpt_level" integer,
	"readings" jsonb NOT NULL,
	"senses" text[] NOT NULL,
	CONSTRAINT "phrases_phrase_unique" UNIQUE("phrase")
);
--> statement-breakpoint
CREATE TABLE "user_kanji_progress" (
	"user_id" uuid NOT NULL,
	"kanji_id" integer NOT NULL,
	"next_review" timestamp NOT NULL,
	"interval_days" integer DEFAULT 1 NOT NULL,
	"ease_factor" numeric(3, 2) DEFAULT '2.5' NOT NULL,
	"review_count" integer DEFAULT 0 NOT NULL,
	"last_reviewed" timestamp,
	"skill" numeric(3, 2) DEFAULT '0.0' NOT NULL,
	CONSTRAINT "user_kanji_progress_user_id_kanji_id_pk" PRIMARY KEY("user_id","kanji_id")
);
--> statement-breakpoint
CREATE TABLE "user_phrase_progress" (
	"user_id" uuid NOT NULL,
	"phrase_id" integer NOT NULL,
	"next_review" timestamp NOT NULL,
	"interval_days" integer DEFAULT 1 NOT NULL,
	"ease_factor" numeric(3, 2) DEFAULT '2.5' NOT NULL,
	"review_count" integer DEFAULT 0 NOT NULL,
	"last_reviewed" timestamp,
	"skill" numeric(3, 2) DEFAULT '0.0' NOT NULL,
	CONSTRAINT "user_phrase_progress_user_id_phrase_id_pk" PRIMARY KEY("user_id","phrase_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "phrase_components" ADD CONSTRAINT "phrase_components_phrase_id_phrases_id_fk" FOREIGN KEY ("phrase_id") REFERENCES "public"."phrases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phrase_components" ADD CONSTRAINT "phrase_components_kanji_id_kanji_id_fk" FOREIGN KEY ("kanji_id") REFERENCES "public"."kanji"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_kanji_progress" ADD CONSTRAINT "user_kanji_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_kanji_progress" ADD CONSTRAINT "user_kanji_progress_kanji_id_kanji_id_fk" FOREIGN KEY ("kanji_id") REFERENCES "public"."kanji"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_phrase_progress" ADD CONSTRAINT "user_phrase_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_phrase_progress" ADD CONSTRAINT "user_phrase_progress_phrase_id_phrases_id_fk" FOREIGN KEY ("phrase_id") REFERENCES "public"."phrases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_phrase_components_phrase_id" ON "phrase_components" USING btree ("phrase_id");--> statement-breakpoint
CREATE INDEX "idx_phrase_components_kanji_id" ON "phrase_components" USING btree ("kanji_id");--> statement-breakpoint
CREATE INDEX "idx_kanji_next_review" ON "user_kanji_progress" USING btree ("user_id","next_review");--> statement-breakpoint
CREATE INDEX "idx_phrase_next_review" ON "user_phrase_progress" USING btree ("user_id","next_review");
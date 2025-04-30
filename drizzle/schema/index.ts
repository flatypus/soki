import {
  pgTable,
  serial,
  text,
  boolean,
  integer,
  jsonb,
  primaryKey,
  timestamp,
  numeric,
  index,
  uuid,
} from "drizzle-orm/pg-core";
// Fix: Import relations helper
import { relations } from "drizzle-orm";

/** TYPES **/
type ReadingType = { word: string; reading: string };

/** USERS **/
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Fix: Add user relations
export const usersRelations = relations(users, ({ many }) => ({
  userKanjiProgress: many(userKanjiProgress),
  userPhraseProgress: many(userPhraseProgress),
}));

/** KANJI **/
export const kanji = pgTable("kanji", {
  id: serial("id").primaryKey(),
  character: text("character").unique().notNull(),
  isCommon: boolean("is_common").notNull(),
  readings: jsonb("readings").notNull().$type<Array<ReadingType>>(),
  definitions: text("senses").array().notNull(),
  frequency: integer("frequency"),
  strokeCount: integer("stroke_count"),
  jlptLevel: integer("jlpt_level"),
  grade: integer("grade"),
});

// Fix: Add kanji relations
export const kanjiRelations = relations(kanji, ({ many }) => ({
  userProgress: many(userKanjiProgress),
  phraseComponents: many(phraseComponents),
}));

/** PHRASES **/
export const phrases = pgTable("phrases", {
  id: serial("id").primaryKey(),
  phrase: text("phrase").unique().notNull(),
  isCommon: boolean("is_common").notNull(),
  jlptLevel: integer("jlpt_level"),
  readings: jsonb("readings").notNull().$type<Array<ReadingType>>(),
  definitions: text("senses").array().notNull(),
});

// Fix: Add phrase relations
export const phrasesRelations = relations(phrases, ({ many }) => ({
  userProgress: many(userPhraseProgress),
  components: many(phraseComponents),
}));

/** PHRASE COMPONENTS (KANJI IN PHRASES) **/
export const phraseComponents = pgTable(
  "phrase_components",
  {
    phraseId: integer("phrase_id")
      .notNull()
      .references(() => phrases.id, { onDelete: "cascade" }),
    kanjiId: integer("kanji_id")
      .notNull()
      .references(() => kanji.id, { onDelete: "cascade" }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.phraseId, t.kanjiId] }),
    idxPhrase: index("idx_phrase_components_phrase_id").on(t.phraseId),
    idxKanji: index("idx_phrase_components_kanji_id").on(t.kanjiId),
  }),
);

// Fix: Add phraseComponents relations
export const phraseComponentsRelations = relations(
  phraseComponents,
  ({ one }) => ({
    phrase: one(phrases, {
      fields: [phraseComponents.phraseId],
      references: [phrases.id],
    }),
    kanji: one(kanji, {
      fields: [phraseComponents.kanjiId],
      references: [kanji.id],
    }),
  }),
);

/** USER KANJI PROGRESS **/
export const userKanjiProgress = pgTable(
  "user_kanji_progress",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kanjiId: integer("kanji_id")
      .notNull()
      .references(() => kanji.id, { onDelete: "cascade" }),
    nextReview: timestamp("next_review").notNull(),
    intervalDays: integer("interval_days").default(1).notNull(),
    easeFactor: numeric("ease_factor", { precision: 3, scale: 2 })
      .default("2.5")
      .notNull(),
    reviewCount: integer("review_count").default(0).notNull(),
    lastReviewed: timestamp("last_reviewed"),
    skill: numeric("skill", { precision: 3, scale: 2 })
      .default("0.0")
      .notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.kanjiId] }),
    idxNextReview: index("idx_kanji_next_review").on(t.userId, t.nextReview),
  }),
);

// Fix: Add userKanjiProgress relations
export const userKanjiProgressRelations = relations(
  userKanjiProgress,
  ({ one }) => ({
    user: one(users, {
      fields: [userKanjiProgress.userId],
      references: [users.id],
    }),
    kanji: one(kanji, {
      fields: [userKanjiProgress.kanjiId],
      references: [kanji.id],
    }),
  }),
);

/** USER PHRASE PROGRESS **/
export const userPhraseProgress = pgTable(
  "user_phrase_progress",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    phraseId: integer("phrase_id")
      .notNull()
      .references(() => phrases.id, { onDelete: "cascade" }),
    nextReview: timestamp("next_review").notNull(),
    intervalDays: integer("interval_days").default(1).notNull(),
    easeFactor: numeric("ease_factor", { precision: 3, scale: 2 })
      .default("2.5")
      .notNull(),
    reviewCount: integer("review_count").default(0).notNull(),
    lastReviewed: timestamp("last_reviewed"),
    skill: numeric("skill", { precision: 3, scale: 2 })
      .default("0.0")
      .notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.phraseId] }),
    idxNextReview: index("idx_phrase_next_review").on(t.userId, t.nextReview),
  }),
);

// Fix: Add userPhraseProgress relations
export const userPhraseProgressRelations = relations(
  userPhraseProgress,
  ({ one }) => ({
    user: one(users, {
      fields: [userPhraseProgress.userId],
      references: [users.id],
    }),
    phrase: one(phrases, {
      fields: [userPhraseProgress.phraseId],
      references: [phrases.id],
    }),
  }),
);

export type User = typeof users.$inferSelect;
export type Kanji = typeof kanji.$inferSelect;
export type Phrase = typeof phrases.$inferSelect;
export type PhraseComponent = typeof phraseComponents.$inferSelect;
export type UserKanjiProgress = typeof userKanjiProgress.$inferSelect;
export type UserPhraseProgress = typeof userPhraseProgress.$inferSelect;

// Export all schema objects together for db.query
export const schema = {
  users,
  kanji,
  phrases,
  phraseComponents,
  userKanjiProgress,
  userPhraseProgress,
  usersRelations,
  kanjiRelations,
  phrasesRelations,
  phraseComponentsRelations,
  userKanjiProgressRelations,
  userPhraseProgressRelations,
};

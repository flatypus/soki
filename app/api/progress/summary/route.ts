import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  userKanjiProgress,
  userPhraseProgress,
  kanji,
  phrases,
} from "@/drizzle/schema";
import { sql, eq, and, count, avg, desc } from "drizzle-orm";

// Define skill level thresholds (adjust as needed)
const LEARNED_SKILL_THRESHOLD = 0.8; // Consider an item learned if skill >= 0.8

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get("X-User-Id");
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized: User ID missing" },
        { status: 401 },
      );
    }

    // --- Kanji Progress ---
    const kanjiStats = await db
      .select({
        totalCount: count(kanji.id),
      })
      .from(kanji);

    // Using raw SQL for comparison with numeric string column
    const userKanjiStats = await db
      .select({
        learnedCount: count(
          sql`case when ${userKanjiProgress.skill}::numeric >= ${LEARNED_SKILL_THRESHOLD} then 1 else null end`,
        ),
        averageSkill: avg(userKanjiProgress.skill),
        totalReviewed: count(userKanjiProgress.kanjiId),
      })
      .from(userKanjiProgress)
      .where(eq(userKanjiProgress.userId, userId));

    // --- Phrase Progress ---
    const phraseStats = await db
      .select({
        totalCount: count(phrases.id),
      })
      .from(phrases);

    // Using raw SQL for comparison with numeric string column
    const userPhraseStats = await db
      .select({
        learnedCount: count(
          sql`case when ${userPhraseProgress.skill}::numeric >= ${LEARNED_SKILL_THRESHOLD} then 1 else null end`,
        ),
        averageSkill: avg(userPhraseProgress.skill),
        totalReviewed: count(userPhraseProgress.phraseId),
      })
      .from(userPhraseProgress)
      .where(eq(userPhraseProgress.userId, userId));

    // --- Fetch detailed learned items (optional, could be separate endpoint if large) ---
    const learnedKanjiDetails = await db.query.userKanjiProgress.findMany({
      where: and(
        eq(userKanjiProgress.userId, userId),
        sql`${userKanjiProgress.skill}::numeric >= ${LEARNED_SKILL_THRESHOLD}`,
      ),
      // Fix: Fetch the full related kanji object instead of specific columns
      with: {
        kanji: true,
      },
      orderBy: [
        desc(userKanjiProgress.skill),
        desc(userKanjiProgress.lastReviewed),
      ],
      limit: 100, // Limit for performance, add pagination if needed
    });

    const summary = {
      kanji: {
        total: kanjiStats[0]?.totalCount ?? 0,
        learned: userKanjiStats[0]?.learnedCount ?? 0,
        averageSkill: parseFloat(
          userKanjiStats[0]?.averageSkill ?? "0",
        ).toFixed(2),
        totalReviewed: userKanjiStats[0]?.totalReviewed ?? 0,
      },
      phrases: {
        total: phraseStats[0]?.totalCount ?? 0,
        learned: userPhraseStats[0]?.learnedCount ?? 0,
        averageSkill: parseFloat(
          userPhraseStats[0]?.averageSkill ?? "0",
        ).toFixed(2),
        totalReviewed: userPhraseStats[0]?.totalReviewed ?? 0,
      },
      // Map the results, ensuring kanji is not null/undefined
      recentlyLearnedKanji: learnedKanjiDetails
        .filter((item) => item.kanji !== null && item.kanji !== undefined)
        .map((item) => {
          const kanjiData = item.kanji!; // Non-null assertion should be safe after filter
          return {
            id: kanjiData.id,
            character: kanjiData.character,
            definitions: kanjiData.definitions,
            grade: kanjiData.grade,
            jlptLevel: kanjiData.jlptLevel,
            skill: item.skill,
          };
        }),
    };

    return NextResponse.json(summary, { status: 200 });
  } catch (error) {
    console.error("Error fetching progress summary:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json(
      { error: "Internal Server Error", details: errorMessage },
      { status: 500 },
    );
  }
}

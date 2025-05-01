import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  userKanjiProgress,
  userPhraseProgress,
  kanji,
  phrases,
} from "@/drizzle/schema";
import { sql, eq, count, avg, desc } from "drizzle-orm";

// Define skill level thresholds
const LEARNED_SKILL_THRESHOLD = 0.6; // Consider an item learned if skill >= 0.6

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

    // --- Fetch ALL reviewed items for the grid display ---
    const allReviewedKanji = await db.query.userKanjiProgress.findMany({
      where: eq(userKanjiProgress.userId, userId),
      with: {
        kanji: {
          columns: { // Select only necessary columns for the grid
            id: true,
            character: true,
            grade: true,
            jlptLevel: true,
          },
        },
      },
      columns: { // Select only necessary columns from progress
        kanjiId: true,
        skill: true,
        lastReviewed: true,
      },
      orderBy: [desc(userKanjiProgress.lastReviewed)], // Order by last reviewed
      // Potentially add limit/pagination if the number of reviewed items can be very large
    });

    const allReviewedPhrases = await db.query.userPhraseProgress.findMany({
        where: eq(userPhraseProgress.userId, userId),
        with: {
            phrase: {
                columns: { // Select only necessary columns for the grid
                    id: true,
                    phrase: true,
                    jlptLevel: true,
                }
            }
        },
        columns: { // Select only necessary columns from progress
            phraseId: true,
            skill: true,
            lastReviewed: true,
        },
        orderBy: [desc(userPhraseProgress.lastReviewed)],
        // Potentially add limit/pagination
    });

    const summary = {
      kanji: {
        total: kanjiStats[0]?.totalCount ?? 0,
        learned: userKanjiStats[0]?.learnedCount ?? 0,
        averageSkill: parseFloat(
          userKanjiStats[0]?.averageSkill ?? "0",
        ).toFixed(2),
        totalReviewed: userKanjiStats[0]?.totalReviewed ?? 0,
        // Add all reviewed kanji data for the grid
        reviewedItems: allReviewedKanji
          .filter((item) => item.kanji !== null && item.kanji !== undefined)
          .map((item) => ({
            id: item.kanji!.id,
            character: item.kanji!.character,
            skill: item.skill,
            // Add other minimal data needed for grid display if necessary
          })),
      },
      phrases: {
        total: phraseStats[0]?.totalCount ?? 0,
        learned: userPhraseStats[0]?.learnedCount ?? 0,
        averageSkill: parseFloat(
          userPhraseStats[0]?.averageSkill ?? "0",
        ).toFixed(2),
        totalReviewed: userPhraseStats[0]?.totalReviewed ?? 0,
        // Add all reviewed phrase data for the grid
        reviewedItems: allReviewedPhrases
          .filter((item) => item.phrase !== null && item.phrase !== undefined)
          .map((item) => ({
              id: item.phrase!.id,
              phrase: item.phrase!.phrase,
              skill: item.skill,
              // Add other minimal data needed for grid display if necessary
          })),
      },
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


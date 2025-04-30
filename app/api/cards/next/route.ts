import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  kanji,
  phrases,
  userKanjiProgress,
  userPhraseProgress,
  phraseComponents,
  Kanji,
  Phrase,
  UserKanjiProgress,
  UserPhraseProgress,
} from "@/drizzle/schema";
import { sql, eq, and, lte, asc, notInArray } from "drizzle-orm";

// Constants for learning logic
// const NEW_KANJI_PER_SESSION = 5; // Keep for potential future use, commented out for now
// const NEW_PHRASES_PER_SESSION = 3; // Keep for potential future use, commented out for now
const MIN_KANJI_SKILL_FOR_PHRASE = 0.6; // Minimum skill level for constituent kanji before showing phrase

// Define a more specific type for the review card
type ReviewCard =
  | ({ type: "kanji" } & UserKanjiProgress & { kanji: Kanji })
  | ({ type: "phrase" } & UserPhraseProgress & { phrase: Phrase });

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get("X-User-Id");
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized: User ID missing" },
        { status: 401 },
      );
    }

    const now = new Date();

    // --- 1. Check for Due Reviews ---
    const dueKanjiReviews = await db.query.userKanjiProgress.findMany({
      where: and(
        eq(userKanjiProgress.userId, userId),
        lte(userKanjiProgress.nextReview, now),
      ),
      orderBy: [asc(userKanjiProgress.nextReview)],
      limit: 1,
      with: {
        kanji: true,
      },
    });

    const duePhraseReviews = await db.query.userPhraseProgress.findMany({
      where: and(
        eq(userPhraseProgress.userId, userId),
        lte(userPhraseProgress.nextReview, now),
      ),
      orderBy: [asc(userPhraseProgress.nextReview)],
      limit: 1,
      with: {
        phrase: true,
      },
    });

    // Prioritize the oldest due review
    let nextReviewCard: ReviewCard | null = null;
    if (dueKanjiReviews.length > 0 && duePhraseReviews.length > 0) {
      nextReviewCard =
        dueKanjiReviews[0].nextReview < duePhraseReviews[0].nextReview
          ? { type: "kanji", ...dueKanjiReviews[0] }
          : { type: "phrase", ...duePhraseReviews[0] };
    } else if (dueKanjiReviews.length > 0) {
      nextReviewCard = { type: "kanji", ...dueKanjiReviews[0] };
    } else if (duePhraseReviews.length > 0) {
      nextReviewCard = { type: "phrase", ...duePhraseReviews[0] };
    }

    if (nextReviewCard) {
      // Transform card data for frontend
      const cardData =
        nextReviewCard.type === "kanji"
          ? {
              ...nextReviewCard.kanji,
              progress: {
                skill: nextReviewCard.skill,
                nextReview: nextReviewCard.nextReview,
              },
            }
          : {
              ...nextReviewCard.phrase,
              progress: {
                skill: nextReviewCard.skill,
                nextReview: nextReviewCard.nextReview,
              },
            };
      return NextResponse.json({
        card: { type: nextReviewCard.type, ...cardData },
        status: "review",
      });
    }

    // --- 2. Check for New Kanji ---
    const learnedKanjiIdsSubquery = db
      .select({ id: userKanjiProgress.kanjiId })
      .from(userKanjiProgress)
      .where(eq(userKanjiProgress.userId, userId));

    const newKanji = await db.query.kanji.findMany({
      where: notInArray(kanji.id, learnedKanjiIdsSubquery),
      orderBy: [
        asc(kanji.frequency),
        asc(kanji.grade),
        asc(kanji.jlptLevel),
        asc(kanji.strokeCount),
      ],
      limit: 1, // Get the next single kanji based on order
    });

    if (newKanji.length > 0) {
      return NextResponse.json({
        card: { type: "kanji", ...newKanji[0] },
        status: "new",
      });
    }

    // --- 3. Check for New Phrases ---
    const learnedPhraseIdsSubquery = db
      .select({ id: userPhraseProgress.phraseId })
      .from(userPhraseProgress)
      .where(eq(userPhraseProgress.userId, userId));

    // Find phrases where the user hasn't learned them yet
    const candidatePhrases = await db
      .select({
        phraseId: phrases.id,
        phrase: phrases.phrase,
        isCommon: phrases.isCommon,
        jlptLevel: phrases.jlptLevel,
        readings: phrases.readings,
        definitions: phrases.definitions,
        // Aggregate constituent kanji progress
        requiredKanjiCount: sql<number>`count(${phraseComponents.kanjiId})`,
        learnedKanjiCount: sql<number>`count(case when ${userKanjiProgress.skill} >= ${MIN_KANJI_SKILL_FOR_PHRASE} then 1 else null end)`,
      })
      .from(phrases)
      .leftJoin(phraseComponents, eq(phrases.id, phraseComponents.phraseId))
      .leftJoin(
        userKanjiProgress,
        and(
          eq(phraseComponents.kanjiId, userKanjiProgress.kanjiId),
          eq(userKanjiProgress.userId, userId),
        ),
      )
      .where(notInArray(phrases.id, learnedPhraseIdsSubquery))
      .groupBy(phrases.id)
      .orderBy(asc(phrases.jlptLevel), asc(phrases.id)) // Order by JLPT level, then ID
      .having(
        sql`count(${phraseComponents.kanjiId}) = count(case when ${userKanjiProgress.skill} >= ${MIN_KANJI_SKILL_FOR_PHRASE} then 1 else null end)`,
      ); // All constituent kanji meet skill requirement

    if (candidatePhrases.length > 0) {
      // The query already filters for phrases where all constituent kanji meet the skill requirement
      const nextPhrase = candidatePhrases[0];
      // Ensure the structure matches what the frontend expects (similar to KanjiCardData/PhraseCardData)
      const phraseCardData = {
        id: nextPhrase.phraseId,
        phrase: nextPhrase.phrase,
        isCommon: nextPhrase.isCommon,
        jlptLevel: nextPhrase.jlptLevel,
        readings: nextPhrase.readings,
        definitions: nextPhrase.definitions,
      };
      return NextResponse.json({
        card: { type: "phrase", ...phraseCardData },
        status: "new",
      });
    }

    // --- 4. No cards available ---
    return NextResponse.json(
      { message: "No cards available for review or learning right now." },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error fetching next card:", error);
    // Type the error for better handling if needed, but keep generic for response
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json(
      { error: "Internal Server Error", details: errorMessage },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  kanji,
  // phrases, // Removed as unused
  userKanjiProgress,
  userPhraseProgress,
  // phraseComponents, // Removed as unused
  Kanji,
  Phrase,
  UserKanjiProgress,
  UserPhraseProgress,
} from "@/drizzle/schema";
import { eq, and, lte, asc, notInArray } from "drizzle-orm";

// Constants for learning logic
// const NEW_KANJI_PER_SESSION = 5; // Keep for potential future use, commented out for now
// const NEW_PHRASES_PER_SESSION = 3; // Keep for potential future use, commented out for now
// const MIN_KANJI_SKILL_FOR_PHRASE = 0.3; // Removed as unused in this route

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

    console.log("No due reviews found");

    // --- 1.5 Check for Unlocked Phrases (reviewCount = 0) ---
    const unlockedPhrase = await db.query.userPhraseProgress.findFirst({
      where: and(
        eq(userPhraseProgress.userId, userId),
        eq(userPhraseProgress.reviewCount, 0)
      ),
      orderBy: [asc(userPhraseProgress.nextReview)], // Prioritize oldest unlocked
      with: {
        phrase: true,
      },
    });

    if (unlockedPhrase) {
        console.log("Found unlocked phrase:", unlockedPhrase.phrase.phrase);
        // Format similar to review card but with status "new"
        const cardData = {
            ...unlockedPhrase.phrase,
            // No progress data needed for a new card presentation
        };
        return NextResponse.json({
            card: { type: "phrase", ...cardData },
            status: "new",
        });
    }

    console.log("No unlocked phrases found");

    // --- 3. Check for New Kanji ---
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

    // If a new Kanji is found, return it
    if (newKanji.length > 0) {
      console.log("Found new kanji:", newKanji[0].character);
      return NextResponse.json({
        card: { type: "kanji", ...newKanji[0] },
        status: "new",
      });
    }

    console.log("No new kanji found");

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

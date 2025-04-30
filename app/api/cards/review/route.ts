import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
// Fix: Remove unused UserKanjiProgress, UserPhraseProgress imports
import { userKanjiProgress, userPhraseProgress } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";

// Simplified SM-2 like algorithm constants
const MIN_EASE_FACTOR = 1.3;
const INITIAL_EASE_FACTOR = 2.5;
const INITIAL_INTERVAL_NEW = 1; // days for first review after seeing new card
const INITIAL_INTERVAL_LEARNED = 1; // days for first review after getting it right

interface ReviewRequestBody {
  cardId: number;
  cardType: "kanji" | "phrase";
  quality: number; // User response quality (e.g., 0-5, where >= 3 is correct)
}

// Use types inferred from schema for better type safety
type ProgressRecordKanji = typeof userKanjiProgress.$inferSelect;
type ProgressRecordPhrase = typeof userPhraseProgress.$inferSelect;

// Combined type for calculation logic (ensure properties align)
interface CalculationProgressRecord {
  userId: string;
  kanjiId?: number;
  phraseId?: number;
  nextReview: Date;
  intervalDays: number;
  easeFactor: number;
  reviewCount: number;
  lastReviewed: Date | null;
  skill: number;
}

function calculateNextReview(
  progress: CalculationProgressRecord,
  quality: number,
): CalculationProgressRecord {
  const now = new Date();
  let newIntervalDays = progress.intervalDays;
  let newEaseFactor = progress.easeFactor;
  let newSkill = progress.skill;

  if (quality >= 3) {
    // Correct response
    if (progress.reviewCount === 0) {
      newIntervalDays = INITIAL_INTERVAL_LEARNED;
    } else if (progress.reviewCount === 1) {
      newIntervalDays = 6;
    } else {
      newIntervalDays = Math.ceil(progress.intervalDays * newEaseFactor);
    }
    newEaseFactor += 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
    if (newEaseFactor < MIN_EASE_FACTOR) {
      newEaseFactor = MIN_EASE_FACTOR;
    }
    newSkill = Math.min(1.0, progress.skill + 0.1 + (quality - 3) * 0.05);
  } else {
    // Incorrect response
    newIntervalDays = INITIAL_INTERVAL_LEARNED; // Reset interval
    newEaseFactor = Math.max(MIN_EASE_FACTOR, progress.easeFactor - 0.2); // Decrease ease factor
    newSkill = Math.max(0.0, progress.skill - 0.1 - (2 - quality) * 0.05);
  }

  const nextReviewDate = new Date(now);
  nextReviewDate.setDate(now.getDate() + newIntervalDays);

  return {
    ...progress,
    nextReview: nextReviewDate,
    intervalDays: newIntervalDays,
    easeFactor: newEaseFactor,
    reviewCount: progress.reviewCount + 1,
    lastReviewed: now,
    skill: parseFloat(newSkill.toFixed(2)),
  };
}

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get("X-User-Id");
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized: User ID missing" },
        { status: 401 },
      );
    }

    const { cardId, cardType, quality }: ReviewRequestBody =
      await request.json();

    if (
      cardId === undefined ||
      cardType === undefined ||
      quality === undefined
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }
    if (quality < 0 || quality > 5) {
      return NextResponse.json(
        { error: "Invalid quality value (must be 0-5)" },
        { status: 400 },
      );
    }

    let currentProgress: ProgressRecordKanji | ProgressRecordPhrase | undefined;
    let nextProgress: CalculationProgressRecord;

    if (cardType === "kanji") {
      currentProgress = await db.query.userKanjiProgress.findFirst({
        where: and(
          eq(userKanjiProgress.userId, userId),
          eq(userKanjiProgress.kanjiId, cardId),
        ),
      });
    } else {
      // cardType === "phrase"
      currentProgress = await db.query.userPhraseProgress.findFirst({
        where: and(
          eq(userPhraseProgress.userId, userId),
          eq(userPhraseProgress.phraseId, cardId),
        ),
      });
    }

    if (currentProgress) {
      // Update existing progress
      const progressInput: CalculationProgressRecord = {
        userId: currentProgress.userId,
        kanjiId:
          cardType === "kanji"
            ? (currentProgress as ProgressRecordKanji).kanjiId
            : undefined,
        phraseId:
          cardType === "phrase"
            ? (currentProgress as ProgressRecordPhrase).phraseId
            : undefined,
        nextReview: currentProgress.nextReview,
        intervalDays: currentProgress.intervalDays,
        easeFactor: parseFloat(
          currentProgress.easeFactor ?? INITIAL_EASE_FACTOR.toString(),
        ),
        reviewCount: currentProgress.reviewCount,
        lastReviewed: currentProgress.lastReviewed,
        skill: parseFloat(currentProgress.skill ?? "0.0"),
      };
      nextProgress = calculateNextReview(progressInput, quality);

      const updateData = {
        nextReview: nextProgress.nextReview,
        intervalDays: nextProgress.intervalDays,
        easeFactor: nextProgress.easeFactor.toString(),
        reviewCount: nextProgress.reviewCount,
        lastReviewed: nextProgress.lastReviewed,
        skill: nextProgress.skill.toString(),
      };

      if (cardType === "kanji") {
        await db
          .update(userKanjiProgress)
          .set(updateData)
          .where(
            and(
              eq(userKanjiProgress.userId, userId),
              eq(userKanjiProgress.kanjiId, cardId),
            ),
          );
      } else {
        await db
          .update(userPhraseProgress)
          .set(updateData)
          .where(
            and(
              eq(userPhraseProgress.userId, userId),
              eq(userPhraseProgress.phraseId, cardId),
            ),
          );
      }
    } else {
      // First review (treat as new card seen)
      const initialProgressBase: Omit<
        CalculationProgressRecord,
        "nextReview" | "lastReviewed" | "kanjiId" | "phraseId"
      > = {
        userId: userId,
        intervalDays: INITIAL_INTERVAL_NEW,
        easeFactor: INITIAL_EASE_FACTOR,
        reviewCount: 0,
        skill: 0.0,
      };
      const progressInput: CalculationProgressRecord = {
        ...initialProgressBase,
        kanjiId: cardType === "kanji" ? cardId : undefined,
        phraseId: cardType === "phrase" ? cardId : undefined,
        nextReview: new Date(), // Placeholder
        lastReviewed: null,
      };

      const firstReviewQuality = quality >= 3 ? 3 : 0;
      nextProgress = calculateNextReview(progressInput, firstReviewQuality);

      if (quality >= 3) {
        nextProgress.skill = parseFloat(
          (0.1 + (quality - 3) * 0.05).toFixed(2),
        );
      } else {
        nextProgress.skill = 0.0;
      }
      nextProgress.reviewCount = 1;
      nextProgress.lastReviewed = new Date();

      const insertData = {
        userId: nextProgress.userId,
        nextReview: nextProgress.nextReview,
        intervalDays: nextProgress.intervalDays,
        easeFactor: nextProgress.easeFactor.toString(),
        reviewCount: nextProgress.reviewCount,
        lastReviewed: nextProgress.lastReviewed,
        skill: nextProgress.skill.toString(),
      };

      if (cardType === "kanji") {
        await db
          .insert(userKanjiProgress)
          .values({ ...insertData, kanjiId: cardId });
      } else {
        await db
          .insert(userPhraseProgress)
          .values({ ...insertData, phraseId: cardId });
      }
    }

    return NextResponse.json(
      {
        message: "Progress updated successfully",
        nextReview: nextProgress.nextReview,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error updating review progress:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json(
      { error: "Internal Server Error", details: errorMessage },
      { status: 500 },
    );
  }
}

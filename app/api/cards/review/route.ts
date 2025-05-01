import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
// Fix: Remove unused UserKanjiProgress, UserPhraseProgress imports
// Import necessary schema and functions
import {
  userKanjiProgress,
  userPhraseProgress,
  phraseComponents,
  phrases, // Import phrases table for fetching unlocked phrase details
  // Kanji, // Keep for type hints if needed elsewhere - Removed as unused
  // Phrase, // Keep for type hints if needed elsewhere - Removed as unused
} from "@/drizzle/schema";
import { eq, and, inArray } from "drizzle-orm";

// Simplified SM-2 like algorithm constants
const MIN_EASE_FACTOR = 1.3;
const INITIAL_EASE_FACTOR = 2.5;
const INITIAL_INTERVAL_NEW = 1; // days for first review after seeing new card
const INITIAL_INTERVAL_LEARNED = 1; // days for first review after getting it right
const MIN_KANJI_SKILL_FOR_PHRASE = 0.3; // Threshold for unlocking phrases

// Skill gain constants (Adjusted)
const BASE_SKILL_GAIN_CORRECT = 0.15; // Increased base gain for correct answers
const SKILL_BONUS_PER_QUALITY_POINT = 0.10; // Increased bonus per quality point above 3
const SKILL_PENALTY_PER_QUALITY_POINT = 0.08; // Adjusted penalty
const EASY_RATING_SKILL_BOOST = 0.25; // Additional boost specifically for 'Easy' (quality 4)

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
    // Calculate skill gain
    let skillGain = BASE_SKILL_GAIN_CORRECT + (quality - 3) * SKILL_BONUS_PER_QUALITY_POINT;
    // Add specific boost for 'Easy' rating
    if (quality === 4) {
        skillGain += EASY_RATING_SKILL_BOOST;
    }
    newSkill = Math.min(1.0, progress.skill + skillGain);

  } else {
    // Incorrect response
    newIntervalDays = INITIAL_INTERVAL_LEARNED; // Reset interval
    newEaseFactor = Math.max(MIN_EASE_FACTOR, progress.easeFactor - 0.2); // Decrease ease factor
    // Calculate skill penalty
    const skillPenalty = 0.1 + (2 - quality) * SKILL_PENALTY_PER_QUALITY_POINT;
    newSkill = Math.max(0.0, progress.skill - skillPenalty);
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
    skill: parseFloat(newSkill.toFixed(2)), // Ensure skill is rounded
  }
}

// Helper function to check and unlock phrases
async function checkAndUnlockPhrases(
  userId: string,
  reviewedKanjiId: number,
  newKanjiSkill: number,
): Promise<Array<{ id: number; phrase: string }>> {
  if (newKanjiSkill < MIN_KANJI_SKILL_FOR_PHRASE) {
    return []; // Kanji skill not high enough to unlock anything
  }

  // 1. Find phrases containing the reviewed kanji
  const relatedPhrases = await db
    .selectDistinct({ phraseId: phraseComponents.phraseId })
    .from(phraseComponents)
    .where(eq(phraseComponents.kanjiId, reviewedKanjiId));

  if (relatedPhrases.length === 0) {
    return [];
  }

  // const relatedPhraseIds = relatedPhrases.map((p) => p.phraseId); // Removed as unused
  const newlyUnlockedPhrases: Array<{ id: number; phrase: string }> = [];

  // 2. For each related phrase, check if ALL its components meet the skill threshold
  for (const phraseInfo of relatedPhrases) {
    const phraseId = phraseInfo.phraseId;

    // Check if user already has progress for this phrase
    const existingProgress = await db.query.userPhraseProgress.findFirst({
      where: and(
        eq(userPhraseProgress.userId, userId),
        eq(userPhraseProgress.phraseId, phraseId),
      ),
      columns: { phraseId: true }, // Only need to check existence
    });

    if (existingProgress) {
      continue; // Already learned or unlocked
    }

    // Get all components for this phrase
    const components = await db
      .select({ kanjiId: phraseComponents.kanjiId })
      .from(phraseComponents)
      .where(eq(phraseComponents.phraseId, phraseId));

    const componentKanjiIds = components.map((c) => c.kanjiId);

    // Get user's progress for all components
    const componentProgress = await db
      .select({
        kanjiId: userKanjiProgress.kanjiId,
        skill: userKanjiProgress.skill,
      })
      .from(userKanjiProgress)
      .where(
        and(
          eq(userKanjiProgress.userId, userId),
          inArray(userKanjiProgress.kanjiId, componentKanjiIds),
        ),
      );

    // Check if all components are learned sufficiently
    let allComponentsLearned = true;
    if (componentProgress.length < componentKanjiIds.length) {
      allComponentsLearned = false; // User hasn't learned all component kanji yet
    } else {
      for (const progress of componentProgress) {
        if (parseFloat(progress.skill ?? "0.0") < MIN_KANJI_SKILL_FOR_PHRASE) {
          allComponentsLearned = false;
          break;
        }
      }
    }

    // 3. If all components meet threshold and phrase not started, unlock it
    if (allComponentsLearned) {
      const now = new Date();
      try {
        await db.insert(userPhraseProgress).values({
          userId: userId,
          phraseId: phraseId,
          skill: "0.0",
          reviewCount: 0,
          intervalDays: 0, // Start with 0 interval, ready for first review
          easeFactor: INITIAL_EASE_FACTOR.toString(),
          nextReview: now, // Make it available immediately
          lastReviewed: null,
        });

        // Fetch phrase text to return
        const phraseData = await db.query.phrases.findFirst({
            where: eq(phrases.id, phraseId),
            columns: { phrase: true }
        });

        if (phraseData) {
            newlyUnlockedPhrases.push({ id: phraseId, phrase: phraseData.phrase });
        }

      } catch (insertError) {
        // Handle potential unique constraint violation if unlock happens concurrently (unlikely but possible)
        console.warn(`Failed to insert unlock record for phrase ${phraseId}, user ${userId}. Might already exist.`, insertError);
      }
    }
  }

  return newlyUnlockedPhrases;
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
    // Adjust quality mapping if frontend sends 1-4
    // Assuming frontend sends 1-4, map to 0-5 internally (e.g., 1->0, 2->2, 3->3, 4->4)
    // Or adjust the quality checks (>=3) and calculations accordingly.
    // For now, assuming quality is 0-5 as per original comment.
    if (quality < 0 || quality > 5) {
      return NextResponse.json(
        { error: "Invalid quality value (must be 0-5)" },
        { status: 400 },
      );
    }

    let currentProgress: ProgressRecordKanji | ProgressRecordPhrase | undefined;
    let nextProgress: CalculationProgressRecord;
    let unlockedPhrases: Array<{ id: number; phrase: string }> = []; // Initialize unlockedPhrases

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

        // --- Check for newly unlocked phrases ---
        unlockedPhrases = await checkAndUnlockPhrases(userId, cardId, nextProgress.skill);
        // ----------------------------------------

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

      // Calculate initial skill based on first review quality
      let initialSkill = 0.0;
      if (quality >= 3) {
          let skillGain = BASE_SKILL_GAIN_CORRECT + (quality - 3) * SKILL_BONUS_PER_QUALITY_POINT;
          if (quality === 4) {
              skillGain += EASY_RATING_SKILL_BOOST;
          }
          initialSkill = Math.min(1.0, skillGain);
      }

      // Use calculateNextReview to get interval, ease factor etc. based on first quality
      // Pass a temporary quality for interval calculation (e.g., 3 if correct, 0 if incorrect)
      const tempQualityForInterval = quality >= 3 ? 3 : 0;
      nextProgress = calculateNextReview(progressInput, tempQualityForInterval);

      // Override skill and review count for the first review
      nextProgress.skill = parseFloat(initialSkill.toFixed(2));
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
        unlockedPhrases: unlockedPhrases, // Include unlocked phrases in the response
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

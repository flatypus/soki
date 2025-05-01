import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  userKanjiProgress,
  userPhraseProgress,
  kanji,
  phrases,
} from "@/drizzle/schema";
import { sql, eq, count, avg, desc, asc } from "drizzle-orm";

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

    // Get pagination parameters from query string
    const { searchParams } = new URL(request.url);
    const pageKanji = parseInt(searchParams.get("pageKanji") || "1", 10);
    const pagePhrase = parseInt(searchParams.get("pagePhrase") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "50", 10); // Default page size 50
    const kanjiSortBy = searchParams.get("kanjiSortBy") || "lastReviewed_desc"; // Default sort
    const phraseSortBy = searchParams.get("phraseSortBy") || "lastReviewed_desc"; // Default sort

    const offsetKanji = (pageKanji - 1) * pageSize;
    const offsetPhrase = (pagePhrase - 1) * pageSize;

    // --- Define Kanji Sorting Logic ---
    let kanjiOrderBy;
    switch (kanjiSortBy) {
      case "frequency_asc":
        kanjiOrderBy = [asc(kanji.frequency), asc(userKanjiProgress.lastReviewed)];
        break;
      case "frequency_desc":
        kanjiOrderBy = [desc(kanji.frequency), asc(userKanjiProgress.lastReviewed)];
        break;
      case "skill_asc":
        kanjiOrderBy = [asc(userKanjiProgress.skill), asc(userKanjiProgress.lastReviewed)];
        break;
      case "skill_desc":
        kanjiOrderBy = [desc(userKanjiProgress.skill), asc(userKanjiProgress.lastReviewed)];
        break;
      case "lastReviewed_asc":
        kanjiOrderBy = [asc(userKanjiProgress.lastReviewed)];
        break;
      case "lastReviewed_desc":
      default:
        kanjiOrderBy = [desc(userKanjiProgress.lastReviewed)];
        break;
    }

    // --- Define Phrase Sorting Logic ---
    let phraseOrderBy;
    switch (phraseSortBy) {
      case "jlptLevel_asc": // Proxy for commonality/difficulty
        phraseOrderBy = [asc(phrases.jlptLevel), asc(userPhraseProgress.lastReviewed)];
        break;
      case "jlptLevel_desc":
        phraseOrderBy = [desc(phrases.jlptLevel), asc(userPhraseProgress.lastReviewed)];
        break;
      case "skill_asc":
        phraseOrderBy = [asc(userPhraseProgress.skill), asc(userPhraseProgress.lastReviewed)];
        break;
      case "skill_desc":
        phraseOrderBy = [desc(userPhraseProgress.skill), asc(userPhraseProgress.lastReviewed)];
        break;
      case "lastReviewed_asc":
        phraseOrderBy = [asc(userPhraseProgress.lastReviewed)];
        break;
      case "lastReviewed_desc":
      default:
        phraseOrderBy = [desc(userPhraseProgress.lastReviewed)];
        break;
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

    // Get total reviewed counts for pagination
    const totalReviewedKanjiCount = userKanjiStats[0]?.totalReviewed ?? 0;
    const totalPagesKanji = Math.ceil(totalReviewedKanjiCount / pageSize);


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

    // Get total reviewed counts for pagination
    const totalReviewedPhraseCount = userPhraseStats[0]?.totalReviewed ?? 0;
    const totalPagesPhrase = Math.ceil(totalReviewedPhraseCount / pageSize);


    // --- Fetch ALL reviewed items for the grid display ---
    let rawReviewedKanji;
    if (kanjiSortBy === "frequency_asc" || kanjiSortBy === "frequency_desc") {
      // Use explicit join for frequency sorting
      rawReviewedKanji = await db
        .select() // Select all columns from both tables
        .from(userKanjiProgress)
        .leftJoin(kanji, eq(userKanjiProgress.kanjiId, kanji.id))
        .where(eq(userKanjiProgress.userId, userId))
        .orderBy(kanjiOrderBy) // Apply dynamic sorting (now works for frequency)
        .limit(pageSize)
        .offset(offsetKanji);
    } else {
      // Use findMany with 'with' for other sorting options
      rawReviewedKanji = await db.query.userKanjiProgress.findMany({
        where: eq(userKanjiProgress.userId, userId),
        with: {
          kanji: {
            columns: { // Select ALL necessary columns for the dialog
              id: true,
              character: true,
              definitions: true,
              readings: true,
              grade: true,
              jlptLevel: true,
              strokeCount: true,
              frequency: true,
            },
          },
        },
        columns: { // Select necessary columns from progress
          kanjiId: true,
          skill: true,
          lastReviewed: true,
          reviewCount: true, // Added reviewCount
        },
        orderBy: kanjiOrderBy, // Apply dynamic sorting
        limit: pageSize,
        offset: offsetKanji,
      });
    }

    // Normalize the structure before mapping
    const allReviewedKanji = rawReviewedKanji.map(item => {
        // Handle potential null kanji from leftJoin if a progress record exists without a matching kanji (shouldn't happen with foreign keys)
        if (!item) return null; 

        if (kanjiSortBy === "frequency_asc" || kanjiSortBy === "frequency_desc") {
            // Structure from db.select() is { userKanjiProgress: {...}, kanji: {...} }
            // Need to transform it to match findMany's structure { ..., kanji: {...} }
            // Ensure userKanjiProgress and kanji are not null before spreading/accessing
            if (!item.userKanjiProgress || !item.kanji) return null;
            return {
                ...item.userKanjiProgress, // Spread progress fields
                kanji: item.kanji // Keep kanji details nested
            };
        } else {
            // Structure from findMany is already correct
            return item;
        }
    }).filter(item => item !== null); // Filter out any null items from normalization step

    const allReviewedPhrases = await db.query.userPhraseProgress.findMany({
        where: eq(userPhraseProgress.userId, userId),
        with: {
            phrase: {
                columns: { // Select ALL necessary columns for the dialog
                    id: true,
                    phrase: true,
                    definitions: true,
                    readings: true,
                    jlptLevel: true,
                }
            }
        },
        columns: { // Select necessary columns from progress
            phraseId: true,
            skill: true,
            lastReviewed: true,
            reviewCount: true, // Added reviewCount
        },
        orderBy: phraseOrderBy, // Apply dynamic sorting
        limit: pageSize,
        offset: offsetPhrase,
    });

    const summary = {
      kanji: {
        total: kanjiStats[0]?.totalCount ?? 0,
        learned: userKanjiStats[0]?.learnedCount ?? 0,
        averageSkill: parseFloat(
          userKanjiStats[0]?.averageSkill ?? "0",
        ).toFixed(2),
        totalReviewed: totalReviewedKanjiCount, // Use calculated total
        currentPage: pageKanji,
        totalPages: totalPagesKanji,
        // Add paginated reviewed kanji data for the grid
        reviewedItems: allReviewedKanji
          .filter((item) => item.kanji !== null && item.kanji !== undefined)
          .map((item) => ({
            id: item.kanji!.id,
            character: item.kanji!.character,
            skill: item.skill,
            // Add ALL details for the dialog
            definitions: item.kanji!.definitions,
            readings: item.kanji!.readings,
            grade: item.kanji!.grade,
            jlptLevel: item.kanji!.jlptLevel,
            strokeCount: item.kanji!.strokeCount,
            frequency: item.kanji!.frequency,
            lastReviewed: item.lastReviewed,
            reviewCount: item.reviewCount, // Assuming reviewCount is available in userKanjiProgress
          })),
      },
      phrases: {
        total: phraseStats[0]?.totalCount ?? 0,
        learned: userPhraseStats[0]?.learnedCount ?? 0,
        averageSkill: parseFloat(
          userPhraseStats[0]?.averageSkill ?? "0",
        ).toFixed(2),
        totalReviewed: totalReviewedPhraseCount, // Use calculated total
        currentPage: pagePhrase,
        totalPages: totalPagesPhrase,
        // Add paginated reviewed phrase data for the grid
        reviewedItems: allReviewedPhrases
          .filter((item) => item.phrase !== null && item.phrase !== undefined)
          .map((item) => ({
              id: item.phrase!.id,
              phrase: item.phrase!.phrase,
              skill: item.skill,
              // Add ALL details for the dialog
              definitions: item.phrase!.definitions,
              readings: item.phrase!.readings,
              jlptLevel: item.phrase!.jlptLevel,
              lastReviewed: item.lastReviewed,
              reviewCount: item.reviewCount, // Added reviewCount
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


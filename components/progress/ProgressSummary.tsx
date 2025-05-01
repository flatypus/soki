"use client";

import {
  useState,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ProgressSummaryHandle } from "@/app/page";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface ProgressSummaryProps {
  token: string;
}

// Interface for items within the reviewedItems array (adjust based on actual API response)
interface ReviewedItemDetail {
  id: number;
  character?: string; // For Kanji
  phrase?: string;    // For Phrases
  skill: string; // API sends as string
  // Add other minimal fields if needed by the grid/dialog, fetched by the summary API
  // The detailed fetch for the dialog might need to be separate if summary API doesn't provide enough
  // For now, assume summary API provides enough for the grid display
}

// Updated interface to match the backend response structure
interface ProgressData {
  kanji: {
    total: number;
    learned: number;
    averageSkill: string; // API sends as string
    totalReviewed: number;
    reviewedItems: ReviewedItemDetail[]; // Changed from kanjiDetails
  };
  phrases: {
    total: number;
    learned: number;
    averageSkill: string; // API sends as string
    totalReviewed: number;
    reviewedItems: ReviewedItemDetail[]; // Changed from phraseDetails
  };
}

// --- Mock Detailed Data Interfaces (assuming separate fetch or more data in summary) ---
// These are needed for the Dialog content. If summary API doesn't provide these,
// the Dialog would need its own data fetching logic based on item ID.
interface KanjiProgressDetailFull extends ReviewedItemDetail {
  character: string;
  definitions: string[];
  grade: number | null;
  jlptLevel: number | null;
  readings: { word: string; reading: string }[];
  strokeCount?: number | null;
  frequency?: number | null;
  lastReviewed: Date | null;
  reviewCount: number;
}

interface PhraseProgressDetailFull extends ReviewedItemDetail {
  phrase: string;
  definitions: string[];
  jlptLevel: number | null;
  readings: { word: string; reading: string }[];
  lastReviewed: Date | null;
  reviewCount: number;
}
// --- End Mock Detailed Data Interfaces ---

const API_ENDPOINT = "/api/progress/summary"; // Removed ?detailed=true as backend sends all reviewed now

export const ProgressSummary = forwardRef<
  ProgressSummaryHandle,
  ProgressSummaryProps
>(({ token }, ref) => {
  const [summary, setSummary] = useState<ProgressData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // State to hold detailed data for the currently open dialog
  const [dialogDetails, setDialogDetails] = useState<KanjiProgressDetailFull | PhraseProgressDetailFull | null>(null);
  const [isDialogLoading, setIsDialogLoading] = useState(false);

  const fetchSummary = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch(API_ENDPOINT,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || `HTTP error! status: ${response.status}`,
        );
      }
      const data: ProgressData = await response.json();
      setSummary(data);
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to load progress summary.";
      console.error("Failed to fetch progress summary:", err);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  // Function to fetch detailed data for the dialog
  // TODO: Implement actual API endpoint for fetching details by ID
  const fetchDialogDetails = useCallback(async (id: number, type: "kanji" | "phrase") => {
    setIsDialogLoading(true);
    setDialogDetails(null); // Clear previous details
    console.log(`Fetching details for ${type} ID: ${id}`);
    // --- MOCK IMPLEMENTATION --- Replace with actual API call
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
    if (type === "kanji") {
        const mockDetail: KanjiProgressDetailFull = {
            id: id,
            character: summary?.kanji.reviewedItems.find(i => i.id === id)?.character ?? "?",
            skill: summary?.kanji.reviewedItems.find(i => i.id === id)?.skill ?? "0",
            definitions: ["Mock Definition 1", "Mock Definition 2"],
            grade: 1,
            jlptLevel: 5,
            readings: [{ word: "", reading: "モック" }],
            strokeCount: 5,
            frequency: 100,
            lastReviewed: new Date(),
            reviewCount: 3,
        };
        setDialogDetails(mockDetail);
    } else {
        const mockDetail: PhraseProgressDetailFull = {
            id: id,
            phrase: summary?.phrases.reviewedItems.find(i => i.id === id)?.phrase ?? "???",
            skill: summary?.phrases.reviewedItems.find(i => i.id === id)?.skill ?? "0",
            definitions: ["Mock Phrase Definition 1", "Mock Phrase Definition 2"],
            jlptLevel: 4,
            readings: [{ word: "", reading: "モックフレーズ" }],
            lastReviewed: new Date(),
            reviewCount: 2,
        };
        setDialogDetails(mockDetail);
    }
    // --- END MOCK IMPLEMENTATION ---
    setIsDialogLoading(false);
  }, [summary]); // Dependency on summary to access basic info for mock

  useImperativeHandle(ref, () => ({
    refreshSummary() {
      fetchSummary();
    },
  }));

  useEffect(() => {
    setIsLoading(true);
    fetchSummary();
  }, [fetchSummary]);

  const calculatePercentage = (learned: number, total: number) => {
    return total > 0 ? Math.round((learned / total) * 100) : 0;
  };

  const getSkillColor = (skillString: string): string => {
    const skill = parseFloat(skillString); // Parse skill string to number
    if (skill >= 0.95) return "bg-purple-600 hover:bg-purple-700";
    if (skill >= 0.8) return "bg-indigo-600 hover:bg-indigo-700";
    if (skill >= 0.6) return "bg-blue-500 hover:bg-blue-600";
    if (skill >= 0.4) return "bg-orange-500 hover:bg-orange-600";
    if (skill > 0) return "bg-yellow-500 hover:bg-yellow-600";
    return "bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600";
  };

  const renderProgressGrid = (
    items: ReviewedItemDetail[], // Use updated interface
    type: "kanji" | "phrase",
  ) => {
    if (!items || items.length === 0) {
      return (
        <p className="text-sm text-muted-foreground dark:text-gray-400">
          No {type} progress recorded yet.
        </p>
      );
    }

    // Sort items: by skill descending
    const sortedItems = [...items].sort((a, b) => {
      return parseFloat(b.skill) - parseFloat(a.skill);
    });

    return (
      <div className="flex flex-wrap gap-1.5">
        {sortedItems.map((item) => (
          <Dialog key={`${type}-${item.id}`}>
            <DialogTrigger asChild>
              <button
                onClick={() => fetchDialogDetails(item.id, type)} // Fetch details on click
                className={`w-7 h-7 rounded-md flex items-center justify-center text-sm font-bold text-white transition-colors duration-150 ${getSkillColor(
                  item.skill, // Pass skill string
                )}`}
                title={type === "kanji" ? item.character : item.phrase}
              >
                {/* Keep boxes blank */}
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              {isDialogLoading && <Skeleton className="h-48 w-full" />} {/* Loading state */}
              {!isDialogLoading && dialogDetails && (
                <>
                  <DialogHeader>
                    <DialogTitle className="text-5xl text-center mb-3 font-serif">
                      {
                        type === "kanji"
                          ? (dialogDetails as KanjiProgressDetailFull).character
                          : (dialogDetails as PhraseProgressDetailFull).phrase
                      }
                    </DialogTitle>
                    <DialogDescription className="text-center space-x-1">
                      {type === "kanji" && (dialogDetails as KanjiProgressDetailFull).grade && (
                        <Badge variant="secondary">Grade {(dialogDetails as KanjiProgressDetailFull).grade}</Badge>
                      )}
                      {dialogDetails.jlptLevel && (
                        <Badge variant="secondary">JLPT N{dialogDetails.jlptLevel}</Badge>
                      )}
                      {type === "kanji" && (dialogDetails as KanjiProgressDetailFull).frequency !== 99999 && (dialogDetails as KanjiProgressDetailFull).frequency !== null && (
                          <Badge variant="outline">Freq: {(dialogDetails as KanjiProgressDetailFull).frequency}</Badge>
                        )}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-3 py-3 text-sm">
                    <div>
                      <h4 className="font-medium text-gray-600 dark:text-gray-300 mb-1">Skill Level:</h4>
                      <Progress
                        value={parseFloat(dialogDetails.skill) * 100} // Parse skill string
                        className="w-full h-2 mb-1"
                      />
                      <p className="text-xs text-muted-foreground dark:text-gray-400">
                        {dialogDetails.skill} ({Math.round(parseFloat(dialogDetails.skill) * 100)}%)
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-600 dark:text-gray-300 mb-1">Readings:</h4>
                      <ul className="list-disc list-inside text-gray-700 dark:text-gray-200">
                        {dialogDetails.readings?.map((r, index) => (
                          <li key={index}>
                            {r.reading}{" "}
                            {r.word &&
                            r.word !==
                              (type === "kanji"
                                ? (dialogDetails as KanjiProgressDetailFull).character
                                : (dialogDetails as PhraseProgressDetailFull).phrase)
                              ? `(${r.word})`
                              : ""}
                          </li>
                        )) ?? <li>No readings available</li>}
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-600 dark:text-gray-300 mb-1">Definitions:</h4>
                      <ul className="list-disc list-inside text-gray-700 dark:text-gray-200">
                        {dialogDetails.definitions?.slice(0, 5).map((def, index) => (
                          <li key={index}>{def}</li>
                        )) ?? <li>No definitions available</li>}
                        {dialogDetails.definitions && dialogDetails.definitions.length > 5 && (
                          <li className="text-muted-foreground dark:text-gray-400">...and more</li>
                        )}
                      </ul>
                    </div>
                    {type === "kanji" && (dialogDetails as KanjiProgressDetailFull).strokeCount && (
                      <p className="text-xs text-muted-foreground dark:text-gray-400">
                        Strokes: {(dialogDetails as KanjiProgressDetailFull).strokeCount}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground dark:text-gray-400">
                      Reviewed: {dialogDetails.reviewCount ?? 0} times
                    </p>
                    <p className="text-xs text-muted-foreground dark:text-gray-400">
                      Last Reviewed:{" "}
                      {dialogDetails.lastReviewed
                        ? new Date(dialogDetails.lastReviewed).toLocaleDateString()
                        : "Never"}
                    </p>
                  </div>
                </>
              )}
              {!isDialogLoading && !dialogDetails && (
                  <p>Could not load details.</p> // Error state
              )}
            </DialogContent>
          </Dialog>
        ))}
      </div>
    );
  };

  if (isLoading && !summary) {
    return (
      <Card className="mt-6 bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-800 dark:via-gray-900 dark:to-indigo-900/30 shadow-md">
        <CardHeader>
          <Skeleton className="h-6 w-1/3 mb-4" />
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-5 w-1/5 mb-2" />
            <Skeleton className="h-4 w-full mb-1" />
            <Skeleton className="h-4 w-3/4 mb-3" />
            <div className="flex flex-wrap gap-1.5">
              {[...Array(30)].map((_, i) => (
                <Skeleton key={i} className="w-7 h-7 rounded-md" />
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Skeleton className="h-5 w-1/5 mb-2" />
            <Skeleton className="h-4 w-full mb-1" />
            <Skeleton className="h-4 w-3/4 mb-3" />
            <div className="flex flex-wrap gap-1.5">
              {[...Array(15)].map((_, i) => (
                <Skeleton key={i} className="w-7 h-7 rounded-md" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Error Loading Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">{error}</p>
          <Button onClick={fetchSummary} className="mt-4">
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!summary) {
    return null;
  }

  const kanjiLearnedPercent = calculatePercentage(
    summary.kanji.learned,
    summary.kanji.total,
  );
  const phraseLearnedPercent = calculatePercentage(
    summary.phrases.learned,
    summary.phrases.total,
  );

  return (
    <Card className="mt-6 bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-800 dark:via-gray-900 dark:to-indigo-900/30 shadow-lg rounded-lg overflow-hidden">
      <CardHeader className="bg-white dark:bg-gray-800/50 border-b dark:border-gray-700/50 px-5 py-3">
        <CardTitle className="text-lg font-semibold text-gray-800 dark:text-gray-100">
          Your Learning Journey
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 p-5">
        <div>
          <h4 className="font-semibold mb-2 text-base text-gray-700 dark:text-gray-200">
            Kanji Mastery
          </h4>
          <Progress
            value={kanjiLearnedPercent}
            className="w-full mb-1 h-2.5 bg-gray-200 dark:bg-gray-700 [&>div]:bg-gradient-to-r [&>div]:from-blue-400 [&>div]:to-blue-600"
          />
          <p className="text-xs text-muted-foreground dark:text-gray-400">
            {summary.kanji.learned} / {summary.kanji.total} Learned ({kanjiLearnedPercent}%)
            <span className="mx-1.5">|</span>
            {/* Parse averageSkill string to number for display */} 
            Avg Skill: {parseFloat(summary.kanji.averageSkill).toFixed(2)}
            <span className="mx-1.5">|</span>
            Reviewed: {summary.kanji.totalReviewed}
          </p>
          <div className="mt-3">
            {/* Pass the correct data path */}
            {renderProgressGrid(summary.kanji.reviewedItems, "kanji")}
          </div>
        </div>
        <div>
          <h4 className="font-semibold mb-2 text-base text-gray-700 dark:text-gray-200">
            Phrase Fluency
          </h4>
          <Progress
            value={phraseLearnedPercent}
            className="w-full mb-1 h-2.5 bg-gray-200 dark:bg-gray-700 [&>div]:bg-gradient-to-r [&>div]:from-purple-400 [&>div]:to-purple-600"
          />
          <p className="text-xs text-muted-foreground dark:text-gray-400">
            {summary.phrases.learned} / {summary.phrases.total} Learned ({phraseLearnedPercent}%)
            <span className="mx-1.5">|</span>
            {/* Parse averageSkill string to number for display */} 
            Avg Skill: {parseFloat(summary.phrases.averageSkill).toFixed(2)}
            <span className="mx-1.5">|</span>
            Reviewed: {summary.phrases.totalReviewed}
          </p>
          <div className="mt-3">
            {/* Pass the correct data path */}
            {renderProgressGrid(summary.phrases.reviewedItems, "phrase")}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

ProgressSummary.displayName = "ProgressSummary";


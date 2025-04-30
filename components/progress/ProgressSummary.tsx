"use client";

import {
  useState,
  useEffect,
  useCallback,
  // useRef, // Removed unused import
  forwardRef,
  useImperativeHandle,
} from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  // CardDescription, // Removed unused import
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
// import { useToast } from "@/components/ui/use-toast"; // Removed unused import
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

interface KanjiProgressDetail {
  id: number;
  character: string;
  definitions: string[];
  grade: number | null;
  jlptLevel: number | null;
  skill: string;
  readings: { word: string; reading: string }[];
  strokeCount?: number | null;
  frequency?: number | null;
  lastReviewed: Date | null;
  reviewCount: number;
}

interface PhraseProgressDetail {
  id: number;
  phrase: string;
  definitions: string[];
  jlptLevel: number | null;
  skill: string;
  readings: { word: string; reading: string }[];
  lastReviewed: Date | null;
  reviewCount: number;
}

interface ProgressData {
  kanji: {
    total: number;
    learned: number;
    averageSkill: string;
    totalReviewed: number;
  };
  phrases: {
    total: number;
    learned: number;
    averageSkill: string;
    totalReviewed: number;
  };
  kanjiDetails: KanjiProgressDetail[];
  phraseDetails: PhraseProgressDetail[];
}

// Update API route to fetch more details for the grid
const API_ENDPOINT = "/api/progress/summary?detailed=true";

export const ProgressSummary = forwardRef<
  ProgressSummaryHandle,
  ProgressSummaryProps
>(({ token }, ref) => {
  const [summary, setSummary] = useState<ProgressData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // const { toast } = useToast(); // Removed unused variable

  const fetchSummary = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch(API_ENDPOINT, { // Use updated endpoint
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
      // Avoid toast on background refresh errors unless critical
      // toast({ title: "Error", description: errorMessage, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [token]); // Removed toast dependency

  useImperativeHandle(ref, () => ({
    refreshSummary() {
      fetchSummary();
    },
  }));

  useEffect(() => {
    setIsLoading(true); // Set loading true on initial mount
    fetchSummary();
  }, [fetchSummary]);

  const calculatePercentage = (learned: number, total: number) => {
    return total > 0 ? Math.round((learned / total) * 100) : 0;
  };

  const getSkillColor = (skill: number): string => {
    if (skill >= 0.95) return "bg-purple-600 hover:bg-purple-700"; // Mastered
    if (skill >= 0.8) return "bg-indigo-600 hover:bg-indigo-700"; // Proficient
    if (skill >= 0.6) return "bg-blue-500 hover:bg-blue-600";
    if (skill >= 0.4) return "bg-orange-500 hover:bg-orange-600"; // Familiar
    if (skill > 0) return "bg-yellow-500 hover:bg-yellow-600"; // Attempted
    return "bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600"; // Not started
  };

  const renderProgressGrid = (
    items: (KanjiProgressDetail | PhraseProgressDetail)[],
    type: "kanji" | "phrase",
  ) => {
    if (!items || items.length === 0) {
      return (
        <p className="text-sm text-muted-foreground dark:text-gray-400">
          No {type} progress recorded yet.
        </p>
      );
    }

    // Sort items: by skill descending, then by last reviewed descending (more recent first)
    const sortedItems = [...items].sort((a, b) => {
      const skillDiff = parseFloat(b.skill) - parseFloat(a.skill);
      if (skillDiff !== 0) return skillDiff;
      const dateA = a.lastReviewed ? new Date(a.lastReviewed).getTime() : 0;
      const dateB = b.lastReviewed ? new Date(b.lastReviewed).getTime() : 0;
      return dateB - dateA; // Sort by most recently reviewed first if skills are equal
    });


    return (
      <div className="flex flex-wrap gap-1.5">
        {sortedItems.map((item) => (
          <Dialog key={`${type}-${item.id}`}>
            <DialogTrigger asChild>
              <button
                className={`w-7 h-7 rounded-md flex items-center justify-center text-sm font-bold text-white transition-colors duration-150 ${getSkillColor(
                  parseFloat(item.skill),
                )}`}
                title={
                  type === "kanji"
                    ? (item as KanjiProgressDetail).character
                    : (item as PhraseProgressDetail).phrase
                }
              >
                {/* Keep boxes blank for cleaner look */}
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-5xl text-center mb-3 font-serif">
                  {
                    type === "kanji"
                      ? (item as KanjiProgressDetail).character
                      : (item as PhraseProgressDetail).phrase
                  }
                </DialogTitle>
                <DialogDescription className="text-center space-x-1">
                  {type === "kanji" && (item as KanjiProgressDetail).grade && (
                    <Badge variant="secondary">Grade {(item as KanjiProgressDetail).grade}</Badge>
                  )}
                  {item.jlptLevel && (
                    <Badge variant="secondary">JLPT N{item.jlptLevel}</Badge>
                  )}
                   {type === "kanji" && (item as KanjiProgressDetail).frequency !== 99999 && (item as KanjiProgressDetail).frequency !== null && (
                       <Badge variant="outline">Freq: {(item as KanjiProgressDetail).frequency}</Badge>
                    )}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 py-3 text-sm">
                <div>
                  <h4 className="font-medium text-gray-600 dark:text-gray-300 mb-1">Skill Level:</h4>
                  <Progress
                    value={parseFloat(item.skill) * 100}
                    className="w-full h-2 mb-1"
                  />
                  <p className="text-xs text-muted-foreground dark:text-gray-400">
                    {item.skill} ({Math.round(parseFloat(item.skill) * 100)}%)
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-600 dark:text-gray-300 mb-1">Readings:</h4>
                  <ul className="list-disc list-inside text-gray-700 dark:text-gray-200">
                    {item.readings.map((r, index) => (
                      <li key={index}>
                        {r.reading}{" "}
                        {r.word &&
                        r.word !==
                          (type === "kanji"
                            ? (item as KanjiProgressDetail).character
                            : (item as PhraseProgressDetail).phrase)
                          ? `(${r.word})`
                          : ""}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-gray-600 dark:text-gray-300 mb-1">Definitions:</h4>
                  <ul className="list-disc list-inside text-gray-700 dark:text-gray-200">
                    {item.definitions.slice(0, 5).map((def, index) => (
                      <li key={index}>{def}</li>
                    ))}
                    {item.definitions.length > 5 && (
                      <li className="text-muted-foreground dark:text-gray-400">...and more</li>
                    )}
                  </ul>
                </div>
                {type === "kanji" && (item as KanjiProgressDetail).strokeCount && (
                  <p className="text-xs text-muted-foreground dark:text-gray-400">
                    Strokes: {(item as KanjiProgressDetail).strokeCount}
                  </p>
                )}
                 <p className="text-xs text-muted-foreground dark:text-gray-400">
                  Reviewed: {item.reviewCount} times
                </p>
                <p className="text-xs text-muted-foreground dark:text-gray-400">
                  Last Reviewed:{" "}
                  {item.lastReviewed
                    ? new Date(item.lastReviewed).toLocaleDateString()
                    : "Never"}
                </p>
              </div>
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
            Avg Skill: {summary.kanji.averageSkill}
            <span className="mx-1.5">|</span>
            Reviewed: {summary.kanji.totalReviewed}
          </p>
          <div className="mt-3">
            {renderProgressGrid(summary.kanjiDetails, "kanji")}
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
            Avg Skill: {summary.phrases.averageSkill}
            <span className="mx-1.5">|</span>
            Reviewed: {summary.phrases.totalReviewed}
          </p>
          <div className="mt-3">
            {renderProgressGrid(summary.phraseDetails, "phrase")}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

ProgressSummary.displayName = "ProgressSummary";


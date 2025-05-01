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

// Updated interface to match the full data returned by the backend API
interface ReviewedItemDetail {
  id: number;
  character?: string; // For Kanji
  phrase?: string;    // For Phrases
  skill: string; // API sends as string
  definitions: string[];
  readings: { word: string; reading: string }[];
  grade?: number | null; // Kanji only
  jlptLevel?: number | null;
  strokeCount?: number | null; // Kanji only
  frequency?: number | null; // Kanji only
  lastReviewed: string | null; // API sends as string or null
  reviewCount: number;
}

// Updated interface to match the backend response structure
interface ProgressData {
  kanji: {
    total: number;
    learned: number;
    averageSkill: string; // API sends as string
    totalReviewed: number;
    currentPage: number; // Added for pagination
    totalPages: number; // Added for pagination
    reviewedItems: ReviewedItemDetail[];
  };
  phrases: {
    total: number;
    learned: number;
    averageSkill: string; // API sends as string
    totalReviewed: number;
    currentPage: number; // Added for pagination
    totalPages: number; // Added for pagination
    reviewedItems: ReviewedItemDetail[];
  };
}

// --- Detailed Data Interfaces (No longer needed as summary API provides full details) ---
// interface KanjiProgressDetailFull extends ReviewedItemDetail { ... }
// interface PhraseProgressDetailFull extends ReviewedItemDetail { ... }
// --- End Detailed Data Interfaces ---

const API_ENDPOINT = "/api/progress/summary"; // Removed ?detailed=true as backend sends all reviewed now

export const ProgressSummary = forwardRef<
  ProgressSummaryHandle,
  ProgressSummaryProps
>(({ token }, ref) => {
  const [summary, setSummary] = useState<ProgressData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // State for pagination
  const [currentPageKanji, setCurrentPageKanji] = useState(1);
  const [currentPagePhrase, setCurrentPagePhrase] = useState(1);
  const [pageSize] = useState(50); // Match backend default, removed unused setPageSize
  // State to hold the item currently selected for the dialog
  const [selectedItem, setSelectedItem] = useState<ReviewedItemDetail | null>(null);

  const fetchSummary = useCallback(async (pageKanji = currentPageKanji, pagePhrase = currentPagePhrase) => {
    setIsLoading(true); // Set loading true when fetching new page
    setError(null);
    try {
      // Construct API endpoint with pagination parameters
      const url = new URL(API_ENDPOINT, window.location.origin);
      url.searchParams.append("pageKanji", pageKanji.toString());
      url.searchParams.append("pagePhrase", pagePhrase.toString());
      url.searchParams.append("pageSize", pageSize.toString());

      const response = await fetch(url.toString(),
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
  }, [token, currentPageKanji, currentPagePhrase, pageSize]); // Added missing dependencies

  // Function to set the selected item for the dialog
  const handleItemClick = useCallback((item: ReviewedItemDetail) => {
    setSelectedItem(item);
  }, []);

  useImperativeHandle(ref, () => ({
    refreshSummary() {
      fetchSummary();
    },
  }));

  useEffect(() => {
    setIsLoading(true);
    fetchSummary(currentPageKanji, currentPagePhrase);
  }, [fetchSummary, currentPageKanji, currentPagePhrase]); // Add page states to dependencies

  const calculatePercentage = (learned: number, total: number) => {
    return total > 0 ? Math.round((learned / total) * 100) : 0;
  };

  const getSkillColor = (skillString: string): string => {
    const skill = parseFloat(skillString); // Parse skill string to number
    if (skill >= 0.95) return "bg-purple-600 hover:bg-purple-700";
    if (skill >= 0.8) return "bg-indigo-600 hover:bg-indigo-700";
    if (skill >= 0.6) return "bg-blue-500 hover:bg-blue-600";
    if (skill >= 0.4) return "bg-teal-500 hover:bg-teal-600"; // Replaced orange with teal
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
                onClick={() => handleItemClick(item)} // Use handleItemClick
                className={`w-7 h-7 rounded-md flex items-center justify-center text-lg font-bold text-white transition-colors duration-150 leading-none ${getSkillColor(
                  item.skill, // Pass skill string
                )}`}
                title={type === "kanji" ? item.character : item.phrase}
              >
                {/* Display character/phrase inside */} 
                {type === "kanji" ? item.character : item.phrase}
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              {/* Remove loading state, use selectedItem directly */}
              {selectedItem && (
                <>
                  <DialogHeader>
                    <DialogTitle className="text-5xl text-center mb-3">
                      {
                        selectedItem.character // Use selectedItem
                          ? selectedItem.character
                          : selectedItem.phrase
                      }
                    </DialogTitle>
                    <DialogDescription className="text-center space-x-1">
                      {selectedItem.character && selectedItem.grade && (
                        <Badge variant="secondary">Grade {selectedItem.grade}</Badge>
                      )}
                      {selectedItem.jlptLevel && (
                        <Badge variant="secondary">JLPT N{selectedItem.jlptLevel}</Badge>
                      )}
                      {selectedItem.character && selectedItem.frequency !== 99999 && selectedItem.frequency !== null && (
                          <Badge variant="outline">Freq: {selectedItem.frequency}</Badge>
                        )}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-3 py-3 text-sm">
                    <div>
                      <h4 className="font-medium text-gray-700 dark:text-gray-200 mb-1">Skill Level:</h4>
                      <Progress
                        value={parseFloat(selectedItem.skill) * 100} // Use selectedItem
                        className="w-full h-2 mb-1"
                      />
                      <p className="text-xs text-gray-600 dark:text-gray-300">
                        {selectedItem.skill} ({Math.round(parseFloat(selectedItem.skill) * 100)}%)
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-700 dark:text-gray-200 mb-1">Readings:</h4>
                      <ul className="list-disc list-inside text-gray-700 dark:text-gray-200">
                        {selectedItem.readings?.length > 0 ? selectedItem.readings.map((r, index) => (
                          <li key={index}>
                            {r.reading}{" "}
                            {r.word &&
                            r.word !==
                              (selectedItem.character
                                ? selectedItem.character
                                : selectedItem.phrase)
                              ? `(${r.word})`
                              : ""}
                          </li>
                        )) : <li>No readings available</li>}
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-700 dark:text-gray-200 mb-1">Definitions:</h4>
                      <ul className="list-disc list-inside text-gray-700 dark:text-gray-200">
                        {selectedItem.definitions?.length > 0 ? selectedItem.definitions.slice(0, 5).map((def, index) => (
                          <li key={index}>{def}</li>
                        )) : <li>No definitions available</li>}
                        {selectedItem.definitions && selectedItem.definitions.length > 5 && (
                          <li className="text-muted-foreground dark:text-gray-400">...and more</li>
                        )}
                      </ul>
                    </div>
                    {selectedItem.character && selectedItem.strokeCount && (
                      <p className="text-xs text-muted-foreground dark:text-gray-400">
                        Strokes: {selectedItem.strokeCount}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground dark:text-gray-400">
                      Reviewed: {selectedItem.reviewCount ?? 0} times
                    </p>
                    <p className="text-xs text-muted-foreground dark:text-gray-400">
                      Last Reviewed:{" "}
                      {selectedItem.lastReviewed
                        ? new Date(selectedItem.lastReviewed).toLocaleDateString()
                        : "Never"}
                    </p>
                  </div>
                </>
              )}
              {!selectedItem && (
                  <p>Select an item to see details.</p> // Placeholder if no item selected
              )}
            </DialogContent>
          </Dialog>
        ))}
      </div>
    );
  };

  // Pagination handlers
  const handlePageChangeKanji = (newPage: number) => {
    if (newPage >= 1 && newPage <= (summary?.kanji.totalPages ?? 1)) {
      setCurrentPageKanji(newPage);
    }
  };

  const handlePageChangePhrase = (newPage: number) => {
    if (newPage >= 1 && newPage <= (summary?.phrases.totalPages ?? 1)) {
      setCurrentPagePhrase(newPage);
    }
  };

  // Component to render pagination controls
  const PaginationControls = ({ currentPage, totalPages, onPageChange }: {
    currentPage: number;
    totalPages: number;
    onPageChange: (newPage: number) => void;
  }) => {
    if (totalPages <= 1) return null; // Don't show controls if only one page

    return (
      <div className="flex items-center justify-center space-x-2 mt-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
        >
          Previous
        </Button>
        <span className="text-sm text-muted-foreground">
          Page {currentPage} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
        >
          Next
        </Button>
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
          <Button onClick={() => fetchSummary()} className="mt-4">
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
            <PaginationControls
              currentPage={summary.kanji.currentPage}
              totalPages={summary.kanji.totalPages}
              onPageChange={handlePageChangeKanji}
            />
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
            <PaginationControls
              currentPage={summary.phrases.currentPage}
              totalPages={summary.phrases.totalPages}
              onPageChange={handlePageChangePhrase}
            />
        </div>
        </div>
      </CardContent>
    </Card>
  );
});

ProgressSummary.displayName = "ProgressSummary";


"use client";

import { useState, useEffect, useCallback } from "react";
// Fix: Remove unused CardDescription
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; 
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button"; // Fix: Import Button

interface ProgressSummaryProps {
  token: string;
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
  recentlyLearnedKanji: {
      id: number;
      character: string;
      definitions: string[];
      grade: number | null;
      jlptLevel: number | null;
      skill: string;
  }[];
}

export function ProgressSummary({ token }: ProgressSummaryProps) {
  const [summary, setSummary] = useState<ProgressData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchSummary = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/progress/summary", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      const data: ProgressData = await response.json();
      setSummary(data);
    } catch (err) {
      // Fix: Use Error type
      const errorMessage = err instanceof Error ? err.message : "Failed to load progress summary.";
      console.error("Failed to fetch progress summary:", err);
      setError(errorMessage);
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [token, toast]);

  useEffect(() => {
    fetchSummary();
    // Optional: Add a refresh interval or button
    // const interval = setInterval(fetchSummary, 60000); // Refresh every minute
    // return () => clearInterval(interval);
  }, [fetchSummary]);

  const calculatePercentage = (learned: number, total: number) => {
    return total > 0 ? Math.round((learned / total) * 100) : 0;
  };

  if (isLoading) {
    return (
      <Card className="mt-6">
        <CardHeader>
          <Skeleton className="h-6 w-3/4" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-1/2" />
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
          {/* Fix: Ensure Button is defined */}
          <Button onClick={fetchSummary} className="mt-4">Try Again</Button>
        </CardContent>
      </Card>
    );
  }

  if (!summary) {
    return null; // Or some placeholder if needed
  }

  const kanjiLearnedPercent = calculatePercentage(summary.kanji.learned, summary.kanji.total);
  const phraseLearnedPercent = calculatePercentage(summary.phrases.learned, summary.phrases.total);

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Your Progress</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="font-semibold mb-1">Kanji</h4>
          <Progress value={kanjiLearnedPercent} className="w-full mb-1" />
          <p className="text-sm text-muted-foreground">
            {summary.kanji.learned} / {summary.kanji.total} Learned ({kanjiLearnedPercent}%)
          </p>
          <p className="text-sm text-muted-foreground">
            Average Skill: {summary.kanji.averageSkill} | Total Reviewed: {summary.kanji.totalReviewed}
          </p>
        </div>
        <div>
          <h4 className="font-semibold mb-1">Phrases</h4>
          <Progress value={phraseLearnedPercent} className="w-full mb-1" />
          <p className="text-sm text-muted-foreground">
            {summary.phrases.learned} / {summary.phrases.total} Learned ({phraseLearnedPercent}%)
          </p>
           <p className="text-sm text-muted-foreground">
            Average Skill: {summary.phrases.averageSkill} | Total Reviewed: {summary.phrases.totalReviewed}
          </p>
        </div>
        {/* Optional: Display recently learned items */}
        {summary.recentlyLearnedKanji && summary.recentlyLearnedKanji.length > 0 && (
          <div>
            <h4 className="font-semibold mb-1">Recently Mastered Kanji</h4>
            <ul className="list-disc list-inside text-sm space-y-1">
              {summary.recentlyLearnedKanji.slice(0, 5).map(item => (
                <li key={item.id}>
                  <span className="text-lg">{item.character}</span> - {item.definitions?.[0] || "No definition"} (Skill: {item.skill})
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


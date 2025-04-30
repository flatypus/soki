"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

interface FlashcardProps {
  token: string;
}

// Remove unused CardType
// type CardType = "kanji" | "phrase";

interface Reading {
  word: string;
  reading: string;
}

interface BaseCardData {
  id: number;
  isCommon: boolean;
  readings: Reading[];
  definitions: string[];
  jlptLevel?: number | null;
}

interface KanjiCardData extends BaseCardData {
  character: string;
  frequency?: number | null;
  strokeCount?: number | null;
  grade?: number | null;
}

interface PhraseCardData extends BaseCardData {
  phrase: string;
}

interface CardResponse {
  card:
    | ({ type: "kanji" } & KanjiCardData)
    | ({ type: "phrase" } & PhraseCardData);
  status: "review" | "new";
}

export function Flashcard({ token }: FlashcardProps) {
  const [currentCard, setCurrentCard] = useState<CardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRevealed, setIsRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchNextCard = useCallback(async () => {
    setIsLoading(true);
    setIsRevealed(false);
    setError(null);
    try {
      const response = await fetch("/api/cards/next", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || `HTTP error! status: ${response.status}`,
        );
      }
      const data = await response.json();
      if (data.card) {
        setCurrentCard(data);
      } else {
        setCurrentCard(null); // No more cards
        toast({
          title: "All Done!",
          description: data.message || "No more cards for now.",
        });
      }
    } catch (err) {
      // Fix: Use Error type
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load the next card.";
      console.error("Failed to fetch next card:", err);
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [token, toast]);

  const submitReview = async (quality: number) => {
    if (!currentCard) return;
    setIsLoading(true); // Indicate loading state during submission
    try {
      const response = await fetch("/api/cards/review", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cardId: currentCard.card.id,
          cardType: currentCard.card.type,
          quality: quality,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || `HTTP error! status: ${response.status}`,
        );
      }
      // Fetch the next card after successful review
      fetchNextCard();
    } catch (err) {
      // Fix: Use Error type
      const errorMessage =
        err instanceof Error ? err.message : "Failed to save review.";
      console.error("Failed to submit review:", err);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      setIsLoading(false); // Stop loading if submission failed
    }
    // No finally block for setIsLoading(false) here, as fetchNextCard handles it
  };

  useEffect(() => {
    fetchNextCard();
  }, [fetchNextCard]);

  const renderCardContent = () => {
    if (!currentCard) {
      return (
        <p className="text-center p-4">
          No more cards for now. Check back later!
        </p>
      );
    }

    const cardData = currentCard.card;

    return (
      <>
        <CardHeader>
          <CardTitle className="text-6xl text-center mb-4">
            {cardData.type === "kanji" ? cardData.character : cardData.phrase}
          </CardTitle>
          <CardDescription className="text-center">
            {currentCard.status === "new" ? "New Card" : "Review Card"}
            {cardData.isCommon && " (Common)"}
            {cardData.jlptLevel && ` (JLPT N${cardData.jlptLevel})`}
            {cardData.type === "kanji" &&
              cardData.grade &&
              ` (Grade ${cardData.grade})`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 min-h-[150px]">
          {isRevealed ? (
            <>
              <div>
                <h4 className="font-semibold mb-1">Readings:</h4>
                <ul className="list-disc list-inside text-sm">
                  {cardData.readings.map((r, index) => (
                    <li key={index}>
                      {r.reading}{" "}
                      {r.word &&
                      r.word !==
                        (cardData.type === "kanji"
                          ? cardData.character
                          : cardData.phrase)
                        ? `(${r.word})`
                        : ""}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-1">Definitions:</h4>
                <ul className="list-disc list-inside text-sm">
                  {cardData.definitions.slice(0, 5).map((def, index) => (
                    <li key={index}>{def}</li>
                  ))}
                  {cardData.definitions.length > 5 && (
                    <li className="text-muted-foreground">...and more</li>
                  )}
                </ul>
              </div>
              {cardData.type === "kanji" && (
                <div className="text-xs text-muted-foreground mt-2">
                  {cardData.strokeCount && `Strokes: ${cardData.strokeCount}`}
                  {cardData.frequency !== 99999 &&
                    cardData.frequency !== null &&
                    ` | Frequency Rank: ${cardData.frequency}`}
                </div>
              )}
            </>
          ) : (
            <div className="flex justify-center items-center h-full">
              <Button onClick={() => setIsRevealed(true)}>Reveal Answer</Button>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-around">
          {isRevealed ? (
            <>
              {/* Quality: 0=Fail(no idea), 1=Fail(slight idea), 2=Fail(got it wrong), 3=Pass(hard), 4=Pass(good), 5=Pass(easy) */}
              <Button
                variant="destructive"
                onClick={() => submitReview(1)}
                disabled={isLoading}
              >
                Again (1)
              </Button>
              <Button
                variant="outline"
                onClick={() => submitReview(3)}
                disabled={isLoading}
              >
                Hard (3)
              </Button>
              <Button
                variant="outline"
                onClick={() => submitReview(4)}
                disabled={isLoading}
              >
                Good (4)
              </Button>
              <Button
                variant="default"
                onClick={() => submitReview(5)}
                disabled={isLoading}
              >
                Easy (5)
              </Button>
            </>
          ) : (
            <span className="text-muted-foreground">
              Reveal the answer to rate your recall.
            </span>
          )}
        </CardFooter>
      </>
    );
  };

  if (error) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Error</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">{error}</p>
          <Button onClick={fetchNextCard} className="mt-4">
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      {isLoading ? (
        <div className="space-y-4 p-6">
          <Skeleton className="h-16 w-1/2 mx-auto" />
          <Skeleton className="h-4 w-1/4 mx-auto" />
          <div className="min-h-[150px] flex justify-center items-center">
            <Skeleton className="h-10 w-24" />
          </div>
          <div className="flex justify-around">
            <Skeleton className="h-10 w-16" />
            <Skeleton className="h-10 w-16" />
            <Skeleton className="h-10 w-16" />
            <Skeleton className="h-10 w-16" />
          </div>
        </div>
      ) : (
        renderCardContent()
      )}
    </Card>
  );
}

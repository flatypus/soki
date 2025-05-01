"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
import { cn } from "@/lib/utils";

// Add CSS for flair animation
const flairStyle = `
  @keyframes flair-up {
    0% { opacity: 1; transform: translateY(0) scale(1); }
    100% { opacity: 0; transform: translateY(-30px) scale(1.2); }
  }
  .flair-animation {
    position: absolute;
    top: -25px; /* Position above the button */
    left: 50%;
    transform: translateX(-50%);
    font-size: 1.2rem;
    font-weight: bold;
    color: #4ade80; /* Green color for positive feedback */
    animation: flair-up 0.7s ease-out forwards;
    pointer-events: none; /* Prevent interaction */
    z-index: 10;
  }
`;

interface FlashcardProps {
  token: string;
  onReviewComplete?: () => void;
}

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

export function Flashcard({ token, onReviewComplete }: FlashcardProps) {
  const [currentCard, setCurrentCard] = useState<CardResponse | null>(null);
  const [preloadedCard, setPreloadedCard] = useState<CardResponse | null>(null); // State for preloaded card
  const [isLoading, setIsLoading] = useState(true);
  const [isRevealed, setIsRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flair, setFlair] = useState<{ id: number; quality: number } | null>(
    null,
  );
  const { toast } = useToast();
  const flipSoundRef = useRef<HTMLAudioElement | null>(null);
  const dingSoundRef = useRef<HTMLAudioElement | null>(null);
  const isFetchingRef = useRef(false); // Ref to prevent concurrent fetches
  const isPreloadingRef = useRef(false); // Ref to prevent concurrent preloads

  // Inject flair CSS
  useEffect(() => {
    const styleElement = document.createElement("style");
    styleElement.innerHTML = flairStyle;
    document.head.appendChild(styleElement);
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  // Initialize audio on client side
  useEffect(() => {
    flipSoundRef.current = new Audio("/sounds/flipcard.mp3");
    dingSoundRef.current = new Audio("/sounds/ding.mp3");
  }, []);

  // Modified playSound to accept potentially null ref and check internally
  const playSound = (soundRef: React.RefObject<HTMLAudioElement | null>) => {
    if (soundRef.current) {
      soundRef.current
        .play()
        .catch((err) => console.error("Error playing sound:", err));
    }
  };

  // Wrap handleReveal in useCallback as it's used in useEffect dependency array
  const handleReveal = useCallback(() => {
    if (!isRevealed) {
      setIsRevealed(true);
      playSound(flipSoundRef); // No need for null check here anymore
    }
  }, [isRevealed]); // Added isRevealed dependency

  // Wrap showFlair in useCallback as it's used in submitReview dependency array
  const showFlair = useCallback((quality: number) => {
    setFlair({ id: Date.now(), quality });
    playSound(dingSoundRef); // No need for null check here anymore
    setTimeout(() => setFlair(null), 700);
  }, []); // Empty dependency array as it doesn't depend on props/state

  // Function to preload the next card
  const preloadNextCard = useCallback(async () => {
    if (isPreloadingRef.current || isFetchingRef.current) return; // Prevent concurrent preloads/fetches
    isPreloadingRef.current = true;
    try {
      const response = await fetch("/api/cards/next", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        // Don't throw error for preload, just log it
        console.error(`Preload failed: ${response.status}`);
        setPreloadedCard(null); // Clear preload if failed
        return;
      }
      const data = await response.json();
      if (data.card) {
        setPreloadedCard(data);
      } else {
        setPreloadedCard(null); // No more cards to preload
      }
    } catch (err) {
      console.error("Failed to preload next card:", err);
      setPreloadedCard(null); // Clear preload on error
    } finally {
      isPreloadingRef.current = false;
    }
  }, [token]);

  // Function to fetch or use preloaded card
  const fetchOrUsePreloadedCard = useCallback(async () => {
    if (isFetchingRef.current) return; // Prevent concurrent fetches
    isFetchingRef.current = true;
    setIsLoading(true);
    setIsRevealed(false);
    setError(null);

    if (preloadedCard) {
      // Use preloaded card
      setCurrentCard(preloadedCard);
      setPreloadedCard(null);
      setIsLoading(false);
      isFetchingRef.current = false;
      // Trigger preload for the *next* card immediately
      preloadNextCard();
    } else {
      // Fetch current card if no preload available
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
          // Trigger preload for the *next* card after fetching current
          preloadNextCard();
        } else {
          setCurrentCard(null);
          toast({
            title: "All Done!",
            description: data.message || "No more cards for now.",
          });
        }
      } catch (err) {
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
        isFetchingRef.current = false;
      }
    }
  }, [token, toast, preloadedCard, preloadNextCard]);

  const submitReview = useCallback(
    async (quality: number) => {
      if (!currentCard || isFetchingRef.current) return; // Prevent review submission while fetching
      showFlair(quality); // Show flair and play sound
      // Don't set isLoading true here, let fetchOrUsePreloadedCard handle it
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
        onReviewComplete?.();
        // Fetch the next card (will use preloaded if available)
        fetchOrUsePreloadedCard();
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to save review.";
        console.error("Failed to submit review:", err);
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
        // Don't set isLoading false here, fetchOrUsePreloadedCard handles it
      }
    },
    [
      currentCard,
      token,
      fetchOrUsePreloadedCard,
      toast,
      onReviewComplete,
      showFlair, // Added showFlair to dependency array
    ],
  );

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Allow space/reveal even if fetching next card, but not review keys
      if (e.code === "Space") {
        if (isLoading && !currentCard) return; // Still block if initial load
        e.preventDefault();
        handleReveal();
        return;
      }

      if (isFetchingRef.current) return; // Block review keys if fetching

      if (isRevealed && currentCard) {
        switch (e.key) {
          case "1":
          case "a":
            submitReview(1);
            break;
          case "2":
          case "s":
            submitReview(2);
            break;
          case "3":
          case "d":
            submitReview(3);
            break;
          case "4":
          case "f":
            submitReview(4);
            break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [isRevealed, isLoading, currentCard, submitReview, handleReveal]); // Added handleReveal to dependency array

  // Initial fetch on mount
  useEffect(() => {
    fetchOrUsePreloadedCard();
  }, [fetchOrUsePreloadedCard]);

  const renderCardFace = (isBackFace = false) => {
    // Use currentCard for rendering
    const cardToRender = currentCard;

    if (!cardToRender) {
      return (
        <Card className="w-full h-full flex items-center justify-center">
          <CardContent>
            <p className="text-center p-4">
              No more cards for now. Check back later!
            </p>
          </CardContent>
        </Card>
      );
    }

    const cardData = cardToRender.card;

    return (
      // Removed h-full from Card, let content dictate height
      <Card className="w-full flex flex-col h-full">
        <CardHeader className="pt-8 pb-2">
          <CardTitle className="text-6xl text-center mb-2">
            {cardData.type === "kanji" ? cardData.character : cardData.phrase}
          </CardTitle>
          <CardDescription className="text-center">
            {cardToRender.status === "new" ? "New Card" : "Review Card"}
            {cardData.isCommon && " (Common)"}
            {cardData.jlptLevel && ` (JLPT N${cardData.jlptLevel})`}
            {cardData.type === "kanji" &&
              cardData.grade &&
              ` (Grade ${cardData.grade})`}
            {cardData.type === "kanji" && (
              <div className="text-xs text-muted-foreground mt-2">
                {cardData.strokeCount && `Strokes: ${cardData.strokeCount}`}
                {cardData.frequency !== 99999 &&
                  cardData.frequency !== null &&
                  ` | Frequency Rank: ${cardData.frequency}`}
              </div>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 py-2 h-full grid place-items-center">
          {isBackFace ? (
            <div className="max-w-[80%] overflow-y-auto max-h-[80px]">
              <div className="flex flex-row gap-[2px] flex-wrap text-sm">
                <span className="font-semibold">Readings:</span>
                {cardData.readings.map((r, index) => (
                  <span key={index} className="text-sm">
                    {r.reading}
                    {r.word &&
                    r.word !==
                      (cardData.type === "kanji"
                        ? cardData.character
                        : cardData.phrase)
                      ? ` (${r.word})`
                      : ""}
                    {index < cardData.readings.length - 1 && ", "}
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap text-sm gap-[2px]">
                <span className="font-semibold">Definitions:</span>
                {cardData.definitions.map((def, index) => (
                  <span key={index}>
                    {def}
                    {index < cardData.definitions.length - 1 && ", "}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center">
              <Button
                onClick={handleReveal}
                disabled={isFetchingRef.current && !currentCard}
              >
                Reveal Answer
              </Button>
            </div>
          )}
        </CardContent>
        {isBackFace && (
          <CardFooter className="flex justify-around pt-2 pb-4 relative w-[450px] mx-auto">
            <>
              <Button
                variant="destructive"
                onClick={() => submitReview(1)}
                disabled={isFetchingRef.current} // Disable if fetching next card
                className="relative"
              >
                Again (1)
                {flair?.quality === 1 && (
                  <span key={flair.id} className="flair-animation">
                    -1
                  </span>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => submitReview(2)}
                disabled={isFetchingRef.current}
                className="relative"
              >
                Hard (2)
                {flair?.quality === 2 && (
                  <span key={flair.id} className="flair-animation">
                    +0
                  </span>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => submitReview(3)}
                disabled={isFetchingRef.current}
                className="relative"
              >
                Good (3)
                {flair?.quality === 3 && (
                  <span key={flair.id} className="flair-animation">
                    +1
                  </span>
                )}
              </Button>
              <Button
                variant="default"
                onClick={() => submitReview(4)}
                disabled={isFetchingRef.current}
                className="relative"
              >
                Easy (4)
                {flair?.quality === 4 && (
                  <span key={flair.id} className="flair-animation">
                    +2
                  </span>
                )}
              </Button>
            </>
          </CardFooter>
        )}
      </Card>
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
          <Button onClick={fetchOrUsePreloadedCard} className="mt-4">
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Show skeleton only during the very initial load
  const showInitialSkeleton = isLoading && !currentCard && !preloadedCard;

  return (
    <div className="perspective w-full">
      <div className={cn("flip-card w-full", { flipped: isRevealed })}>
        <div className="flip-card-inner">
          <div className="flip-card-front">
            {showInitialSkeleton ? (
              <Card className="w-full flex flex-col h-full">
                <CardContent className="flex-grow flex flex-col justify-center items-center py-4">
                  <Skeleton className="h-16 w-1/2 mx-auto mb-2" />
                  <Skeleton className="h-4 w-1/4 mx-auto mb-4" />
                  <Skeleton className="h-10 w-24" />
                </CardContent>
                <CardFooter className="flex justify-around pt-2 pb-4">
                  <Skeleton className="h-6 w-1/2" />
                </CardFooter>
              </Card>
            ) : (
              renderCardFace(false)
            )}
          </div>
          <div className="flip-card-back">
            {showInitialSkeleton ? (
              // Skeleton for back face (can be similar or different)
              <Card className="w-full flex flex-col">
                <CardContent className="flex-grow flex flex-col justify-center items-center py-4">
                  <Skeleton className="h-16 w-1/2 mx-auto mb-2" />
                  <Skeleton className="h-16 w-1/2 mx-auto mb-2" />
                  <Skeleton className="h-4 w-1/4 mx-auto mb-4" />
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2 mb-4" />
                </CardContent>
                <CardFooter className="flex justify-around pt-2 pb-4">
                  <Skeleton className="h-10 w-16" />
                  <Skeleton className="h-10 w-16" />
                  <Skeleton className="h-10 w-16" />
                  <Skeleton className="h-10 w-16" />
                </CardFooter>
              </Card>
            ) : (
              renderCardFace(true)
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

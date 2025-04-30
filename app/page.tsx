"use client";

import { useState, useEffect, useRef, useCallback } from "react"; // Added useRef, useCallback
import { LoginForm } from "@/components/auth/LoginForm";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { Flashcard } from "@/components/flashcard/Flashcard";
import { ProgressSummary } from "@/components/progress/ProgressSummary";
import { Button } from "@/components/ui/button";

// Define handle type for ProgressSummary ref
export interface ProgressSummaryHandle {
  refreshSummary: () => void;
}

export default function Home() {
  const [token, setToken] = useState<string | null>(null);
  const [showLogin, setShowLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const progressSummaryRef = useRef<ProgressSummaryHandle>(null); // Ref for ProgressSummary

  useEffect(() => {
    const storedToken = localStorage.getItem("kanji-token");
    if (storedToken) {
      setToken(storedToken);
    }
    setIsLoading(false);
  }, []);

  const handleLoginSuccess = (newToken: string) => {
    localStorage.setItem("kanji-token", newToken);
    setToken(newToken);
  };

  const handleRegisterSuccess = () => {
    setShowLogin(true);
  };

  const handleLogout = () => {
    localStorage.removeItem("kanji-token");
    setToken(null);
    setShowLogin(true);
  };

  // Callback function to trigger progress refresh
  const handleReviewComplete = useCallback(() => {
    progressSummaryRef.current?.refreshSummary();
  }, []);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        Loading...
      </div>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-24">
      {!token ? (
        showLogin ? (
          <LoginForm
            onLoginSuccess={handleLoginSuccess}
            switchToRegister={() => setShowLogin(false)}
          />
        ) : (
          <RegisterForm
            onRegisterSuccess={handleRegisterSuccess}
            switchToLogin={() => setShowLogin(true)}
          />
        )
      ) : (
        <div className="w-full max-w-2xl">
          <div className="flex justify-end mb-4">
            <Button onClick={handleLogout} variant="outline">
              Logout
            </Button>
          </div>
          {/* Pass the callback to Flashcard */}
          <Flashcard token={token} onReviewComplete={handleReviewComplete} />
          {/* Pass the ref to ProgressSummary */}
          <ProgressSummary ref={progressSummaryRef} token={token} />
        </div>
      )}
    </main>
  );
}


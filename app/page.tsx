"use client";

import { useState, useEffect } from "react";
import { LoginForm } from "@/components/auth/LoginForm";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { Flashcard } from "@/components/flashcard/Flashcard";
import { ProgressSummary } from "@/components/progress/ProgressSummary"; // Import ProgressSummary
import { Button } from "@/components/ui/button";

export default function Home() {
  const [token, setToken] = useState<string | null>(null);
  const [showLogin, setShowLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing token in localStorage on initial load
    const storedToken = localStorage.getItem("kanji-token");
    if (storedToken) {
      // TODO: Add token validation check here? (Optional, depends on security needs)
      setToken(storedToken);
    }
    setIsLoading(false);
  }, []);

  const handleLoginSuccess = (newToken: string) => {
    localStorage.setItem("kanji-token", newToken);
    console.log("newToken", newToken);
    setToken(newToken);
  };

  const handleRegisterSuccess = () => {
    // Switch to login form after successful registration
    setShowLogin(true);
  };

  const handleLogout = () => {
    localStorage.removeItem("kanji-token");
    setToken(null);
    setShowLogin(true); // Show login form after logout
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        Loading...
      </div>
    ); // Or a spinner component
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-24">
      {!token ? (
        // Render Login or Register form if not logged in
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
        // Render Flashcard and Progress if logged in
        <div className="w-full max-w-2xl">
          <div className="flex justify-end mb-4">
            <Button onClick={handleLogout} variant="outline">
              Logout
            </Button>
          </div>
          {/* Flashcard component */}
          <Flashcard token={token} />
          {/* Progress visualization component */}
          <ProgressSummary token={token} />
        </div>
      )}
    </main>
  );
}

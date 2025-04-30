# Kanji Learning Application

## Project Overview

This project is a web application designed to help users learn Japanese Kanji and phrases using a spaced repetition system (SRS). It features user authentication, tracks learning progress, and presents flashcards in an optimal order based on user knowledge and character/phrase dependencies.

## Features

*   **Kanji & Phrase Learning:** Includes a database of Kanji characters and related phrases.
*   **Spaced Repetition System (SRS):** Tracks user familiarity with each Kanji and phrase, scheduling reviews at increasing intervals.
*   **Learning Order:** Ensures users learn individual Kanji characters before encountering phrases that contain them. Constituent Kanji are prioritized before the phrases themselves.
*   **User Authentication:** Secure user registration and login using JWT (JSON Web Tokens) for session management.
*   **Progress Tracking:** Users can view a summary of their learning progress.
*   **Flashcard Interface:** A simple web interface for reviewing Kanji and phrases.

## Technology Stack

*   **Frontend:** Next.js (React Framework), TypeScript, Tailwind CSS, shadcn/ui
*   **Backend:** Next.js API Routes, TypeScript
*   **Database:** PostgreSQL
*   **ORM:** Drizzle ORM
*   **Authentication:** JWT (jsonwebtoken), bcrypt (for password hashing)
*   **Runtime/Build Tool:** Bun

## Setup Instructions

### Prerequisites

*   Node.js (v20+ recommended)
*   Bun (v1.x+ recommended)
*   PostgreSQL Server

### Installation

1.  **Clone the repository (or extract the provided zip file):**
    ```bash
    # If you have the zip file:
    unzip kanji-practice.zip
    cd kanji-practice
    ```
2.  **Install dependencies:**
    ```bash
    bun install
    ```

### Database Setup

1.  **Create a PostgreSQL database and user:**
    ```sql
    -- Example commands (run as postgres superuser)
    CREATE DATABASE kanji_db;
    CREATE USER kanji_user WITH PASSWORD 'password';
    GRANT ALL PRIVILEGES ON DATABASE kanji_db TO kanji_user;
    ```
2.  **Configure Environment Variables:** Create a `.env` file in the project root (`/home/ubuntu/kanji-practice/.env`) with the following content, replacing placeholders with your actual database credentials and a secure JWT secret:
    ```env
    DATABASE_URL="postgresql://kanji_user:password@localhost:5432/kanji_db"
    JWT_SECRET="replace_this_with_a_very_strong_and_secret_key"
    ```
3.  **Run Database Migrations:** Apply the Drizzle schema to your database.
    ```bash
    bun run db:prod-m
    ```
4.  **Import Data:** Populate the database with Kanji and phrase data.
    ```bash
    bun run /home/ubuntu/kanji-practice/scripts/save-to-db.ts
    ```

### Running the Application

1.  **Build the application:**
    ```bash
    bun run build
    ```
2.  **Start the production server:**
    ```bash
    bun run start -p 3000 -H 0.0.0.0
    ```
    The application should now be running on `http://localhost:3000` (or the specified host/port).

## API Endpoints

*   `POST /api/auth/register`: User registration.
*   `POST /api/auth/login`: User login, returns JWT.
*   `GET /api/cards/next`: (Protected) Fetches the next Kanji or Phrase card for the user based on SRS and learning order.
*   `POST /api/cards/review`: (Protected) Updates the user's progress for a specific card after review.
*   `GET /api/progress/summary`: (Protected) Retrieves a summary of the user's learning progress.

_(Protected endpoints require a valid JWT in the `Authorization: Bearer <token>` header)._

## Usage

1.  Access the application URL.
2.  **Register:** Create a new user account.
3.  **Login:** Log in with your credentials.
4.  **Flashcards:** The main page will display the next flashcard (Kanji or Phrase). Reveal the answer and indicate your recall difficulty (e.g., Easy, Good, Hard) to update the SRS schedule.
5.  **Progress:** View your learning summary.

## Deployment Notes

*   A temporary public URL has been provided for testing: [http://3000-ivyawryna3kln9lu9lsev-a7e4866e.manus.computer](http://3000-ivyawryna3kln9lu9lsev-a7e4866e.manus.computer)
*   **This URL is temporary and will expire.**
*   Permanent deployment using the standard tools encountered issues, likely due to environment limitations regarding Next.js server-side features.
*   For persistent deployment, further investigation into compatible hosting platforms or adjustments to the application structure (e.g., separating frontend and backend) might be necessary.


import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/drizzle/schema";
import { hashPassword } from "@/lib/password";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 },
      );
    }

    // Check if user already exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User already exists" },
        { status: 409 },
      );
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const newUser = await db
      .insert(users)
      .values({
        email: email,
        passwordHash: passwordHash,
      })
      .returning({ id: users.id, email: users.email });

    if (!newUser || newUser.length === 0) {
      return NextResponse.json(
        { error: "Failed to create user" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { message: "User created successfully", user: newUser[0] },
      { status: 201 },
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}


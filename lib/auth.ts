import * as jose from "jose";
import { User } from "../drizzle/schema";

// Check for JWT_SECRET first
if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is not set");
}

// Define JWT_SECRET after the check, ensuring it's a string
const JWT_SECRET: string = process.env.JWT_SECRET;

const secret = new TextEncoder().encode(JWT_SECRET);

export async function generateToken(
  user: Pick<User, "id" | "email">,
): Promise<string> {
  const payload = {
    sub: user.id.toString(), // Standard JWT field for subject (user ID)
    email: user.email,
  };

  const newToken = await new jose.SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);

  return newToken;
}

export async function verifyToken(
  token: string,
): Promise<{ sub: string; email: string } | null> {
  try {
    const { payload } = await jose.jwtVerify(token, secret);

    if (!payload.sub || !payload.email) {
      throw new Error("Invalid token payload");
    }

    return {
      sub: payload.sub,
      email: payload.email as string,
    };
  } catch (error) {
    console.error("JWT verification failed:", error);
    return null;
  }
}

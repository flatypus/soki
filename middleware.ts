import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

// Define paths that don't require authentication
const publicPaths = ["/api/auth/login", "/api/auth/register"];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Skip middleware for public paths and Next.js internal paths
  if (
    publicPaths.some((p) => path.startsWith(p)) ||
    path.startsWith("/_next") ||
    path.startsWith("/favicon.ico")
  ) {
    return NextResponse.next();
  }

  // Check for token in Authorization header
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.split(" ")[1]; // Bearer <token>

  if (!token) {
    return NextResponse.json(
      { error: "Authorization token required" },
      { status: 401 },
    );
  }

  // Verify token
  const payload = await verifyToken(token);

  if (!payload) {
    return NextResponse.json(
      { error: "Invalid or expired token" },
      { status: 401 },
    );
  }

  // Validate payload structure
  if (!payload.sub || !payload.email) {
    return NextResponse.json(
      { error: "Malformed token payload" },
      { status: 401 },
    );
  }

  // Add user info to request headers for use in API routes
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("X-User-Id", payload.sub);
  requestHeaders.set("X-User-Email", payload.email);

  // Continue to the requested route with updated headers
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ["/api/:path*"], // Apply middleware to all API routes
};

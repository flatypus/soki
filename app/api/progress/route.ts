// write a get rout that returns the progress of the user

import { NextResponse } from "next/server";

export async function GET() {
  const progress = {};
  return NextResponse.json(progress);
}

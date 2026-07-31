import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    product: "GameForge AI Living Studio",
    version: "0.3.0",
    mode: "pre-production",
    timestamp: new Date().toISOString(),
  });
}

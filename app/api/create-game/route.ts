import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: "Generated-game production is disabled in the GameForge pre-production edition.",
      redirect: "/design-studio",
      supportedWorkflow: "Design, validate, document, and hand off the project before engine development.",
    },
    { status: 410 },
  );
}

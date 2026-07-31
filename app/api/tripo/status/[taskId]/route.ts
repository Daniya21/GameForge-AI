import { NextResponse } from "next/server";
import { getTripoTask, TripoApiError } from "@/lib/providers/tripo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ taskId: string }> },
) {
  try {
    const { taskId } = await context.params;
    const task = await getTripoTask(taskId);
    return NextResponse.json({
      task: {
        taskId: task.taskId,
        status: task.status,
        progress: task.progress,
        modelUrl: task.providerModelUrl ? `/api/tripo/model/${encodeURIComponent(taskId)}` : "",
        previewUrl: task.previewUrl,
        consumedCredits: task.consumedCredits,
      },
    });
  } catch (error) {
    if (error instanceof TripoApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Tripo task status failed:", error);
    return NextResponse.json({ error: "The 3D model task status could not be loaded." }, { status: 500 });
  }
}

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
    const normalizedStatus = task.status.toLowerCase();
    const ready = ["success", "succeeded", "complete", "completed", "finished"].includes(normalizedStatus);
    const failed = ["failed", "failure", "banned", "cancelled", "canceled", "error"].includes(normalizedStatus);
    if (!ready || !task.providerModelUrl) {
      return Response.json(
        { error: failed ? "The Tripo model task failed." : "The Tripo model is not ready yet." },
        { status: failed ? 422 : 409 },
      );
    }

    const upstream = await fetch(task.providerModelUrl, { cache: "no-store" });
    if (!upstream.ok || !upstream.body) {
      return Response.json({ error: "The generated GLB could not be downloaded from Tripo." }, { status: 502 });
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") || "model/gltf-binary",
        "Content-Disposition": `inline; filename="gameforge-${taskId}.glb"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof TripoApiError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("Tripo model proxy failed:", error);
    return Response.json({ error: "The generated 3D model could not be loaded." }, { status: 500 });
  }
}

// Lists every saved smoke run (F4) for the /admin page or external tools.
import { listRunSummaries } from "@/lib/runStore";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({ runs: listRunSummaries() });
}

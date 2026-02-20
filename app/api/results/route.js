import { getSharedResults, submitResult, clearSharedResults } from "@/lib/store";

export async function GET() {
  const results = await getSharedResults();
  return Response.json(results);
}

export async function POST(request) {
  try {
    const { browserKey, column, status, note, userAgent, testerName } = await request.json();

    if (!browserKey || !column || !status) {
      return Response.json({ error: "Missing required fields: browserKey, column, status" }, { status: 400 });
    }

    const updated = await submitResult({ browserKey, column, status, note, userAgent, testerName });
    return Response.json(updated);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE() {
  await clearSharedResults();
  return Response.json({ ok: true });
}

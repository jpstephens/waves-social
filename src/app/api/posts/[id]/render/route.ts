import { NextRequest, NextResponse } from "next/server";
import { requireCoach } from "@/lib/auth";
import { pollRenderAndStore } from "@/lib/pipeline";

export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireCoach();
  const { id } = await params;
  try {
    const result = await pollRenderAndStore(id);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

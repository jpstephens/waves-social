import { NextRequest, NextResponse } from "next/server";
import { requireCoach } from "@/lib/auth";
import { approvePost } from "@/lib/pipeline";

export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireCoach();
  const { id } = await params;
  await approvePost(id);
  return NextResponse.json({ ok: true });
}

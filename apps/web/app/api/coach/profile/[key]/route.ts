import { NextRequest, NextResponse } from "next/server";
import { updateProfile } from "@/lib/agents";
import { prisma } from "@/lib/db";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params;
    const decoded = decodeURIComponent(key);
    await prisma.coachProfile.delete({ where: { key: decoded } });
    return NextResponse.json({ ok: true, key: decoded });
  } catch (err) {
    console.error("Coach profile delete error:", err);
    return NextResponse.json({ error: "Failed to delete Coach profile entry" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params;
    const { value, source } = await req.json();

    if (value === undefined) {
      return NextResponse.json({ error: "value is required" }, { status: 400 });
    }

    await updateProfile(prisma, key, value, source ?? "user_corrected");
    return NextResponse.json({ ok: true, key });
  } catch (err) {
    console.error("Coach profile update error:", err);
    return NextResponse.json({ error: "Failed to update Coach profile" }, { status: 500 });
  }
}

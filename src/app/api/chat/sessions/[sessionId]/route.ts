import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseServerClient } from "../../../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { sessionId } = await params;
    const supabase = getSupabaseServerClient();

    const { data: session, error: sessionError } = await supabase
      .from("chat_sessions")
      .select("id, user_id, therapeutic_area, title, created_at, updated_at")
      .eq("id", sessionId)
      .eq("user_id", userId)
      .single();

    if (sessionError) {
      throw new Error(sessionError.message);
    }

    const { data: messages, error: messagesError } = await supabase
      .from("chat_messages")
      .select("id, role, content, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    if (messagesError) {
      throw new Error(messagesError.message);
    }

    return NextResponse.json({
      ok: true,
      session,
      messages: messages ?? [],
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to load session" },
      { status: 500 }
    );
  }
}
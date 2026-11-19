import { refreshSearchCorpusIntelligence } from "../../../../lib/answers/refreshSearchCorpusIntelligence";
import { NextRequest, NextResponse } from "next/server";
import { getChatAccess, restrictChatQuery } from "../../../../lib/chat/access";
import { getSupabaseServerClient } from "../../../../lib/supabase/server";
import {
  addLegacyWorkspaceField,
  isMissingSessionWorkspaceColumn,
} from "../../../../lib/chat/sessionCompatibility";
import { assertWorkspaceAccess, platformPrincipalFromEntitlements } from "../../../../lib/intelligence-platform";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const access = await getChatAccess();

    if (!access) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const sessionId = req.nextUrl.searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json(
        { ok: false, error: "sessionId is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();

    let {
      data: session,
      error: sessionError,
    } = await restrictChatQuery(supabase
      .from("chat_sessions")
      .select(
        "id, user_id, workspace_id, therapeutic_area, title, is_pinned, created_at, updated_at"
      )
      .eq("id", sessionId), access)
      .single();

    if (
      isMissingSessionWorkspaceColumn(
        sessionError
      )
    ) {
      const legacyResult =
        await restrictChatQuery(supabase
          .from("chat_sessions")
          .select(
            "id, user_id, therapeutic_area, title, is_pinned, created_at, updated_at"
          )
          .eq("id", sessionId), access)
          .single();

      session = legacyResult.data
        ? (addLegacyWorkspaceField(
            legacyResult.data
          ) as typeof session)
        : null;
      sessionError =
        legacyResult.error;
    }

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

    let latestQuestion = "";
    return NextResponse.json({
      ok: true,
      session,
      messages: (messages ?? []).map(message => {
        if (message.role === "user") {
          latestQuestion = typeof message.content === "string" ? message.content : message.content?.text || "";
          return message;
        }
        return message.role === "assistant" ? { ...message, content: refreshSearchCorpusIntelligence(message.content, message.content?.therapeuticArea || session?.therapeutic_area || "", latestQuestion) } : message;
      }),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to load session" },
      { status: error?.status === 403 ? 403 : 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const access = await getChatAccess(true);

    if (!access) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { sessionId, title, isPinned, workspaceId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { ok: false, error: "sessionId is required" },
        { status: 400 }
      );
    }

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (typeof title === "string") {
      const trimmed = title.trim();
      if (!trimmed) {
        return NextResponse.json(
          { ok: false, error: "title cannot be empty" },
          { status: 400 }
        );
      }
      updates.title = trimmed;
    }

    if (typeof isPinned === "boolean") {
      updates.is_pinned = isPinned;
    }

    if (workspaceId === null || typeof workspaceId === "string") {
      if (workspaceId) {
        try {
          await assertWorkspaceAccess(platformPrincipalFromEntitlements(access), workspaceId, "editor");
        } catch (workspaceError: any) {
          return NextResponse.json({ ok: false, error: workspaceError.message || "Workspace access denied" }, { status: 403 });
        }
      }
      updates.workspace_id = workspaceId || null;
    }

    if (Object.keys(updates).length === 1) {
      return NextResponse.json(
        { ok: false, error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();

    const { data, error } = await restrictChatQuery(supabase
      .from("chat_sessions")
      .update(updates)
      .eq("id", sessionId), access)
      .select()
      .single();

    if (error && workspaceId !== undefined && isMissingSessionWorkspaceColumn(error)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Moving conversations between workspaces requires the pending staging database migration.",
        },
        { status: 503 }
      );
    }

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      ok: true,
      session: data,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to update session" },
      { status: error?.status === 403 ? 403 : 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const access = await getChatAccess(true);

    if (!access) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const sessionId = req.nextUrl.searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json(
        { ok: false, error: "sessionId is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();

    const { data: session, error: lookupError } = await restrictChatQuery(supabase
      .from("chat_sessions")
      .select("id")
      .eq("id", sessionId), access)
      .single();

    if (lookupError || !session) {
      return NextResponse.json(
        { ok: false, error: "Session not found" },
        { status: 404 }
      );
    }

    const { error: deleteError } = await restrictChatQuery(supabase
      .from("chat_sessions")
      .delete()
      .eq("id", sessionId), access);

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    return NextResponse.json({
      ok: true,
      deletedSessionId: sessionId,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to delete session" },
      { status: error?.status === 403 ? 403 : 500 }
    );
  }
}

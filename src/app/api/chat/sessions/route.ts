import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseServerClient } from "../../../../lib/supabase/server";
import {
  addLegacyWorkspaceField,
  isMissingSessionWorkspaceColumn,
} from "../../../../lib/chat/sessionCompatibility";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const supabase = getSupabaseServerClient();

    let { data, error } = await supabase
      .from("chat_sessions")
      .select("id, workspace_id, therapeutic_area, title, created_at, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (
      isMissingSessionWorkspaceColumn(
        error
      )
    ) {
      const legacyResult =
        await supabase
          .from("chat_sessions")
          .select(
            "id, therapeutic_area, title, created_at, updated_at"
          )
          .eq("user_id", userId)
          .order("updated_at", {
            ascending: false,
          });

      data = legacyResult.data?.map(
        addLegacyWorkspaceField
      ) as typeof data;
      error = legacyResult.error;
    }

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      ok: true,
      sessions: data ?? [],
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to load sessions" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId, orgId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { therapeuticArea, firstQuestion, workspaceId } = body;

    if (!therapeuticArea) {
      return NextResponse.json(
        { ok: false, error: "therapeuticArea is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();

    if (workspaceId) {
      const { data: permittedWorkspace } = await supabase
        .from("intelligence_workspaces")
        .select("id")
        .eq("id", workspaceId)
        .eq("principal_id", orgId || userId)
        .maybeSingle();
      if (!permittedWorkspace) {
        return NextResponse.json({ ok: false, error: "Workspace not found" }, { status: 404 });
      }
    }

    const title =
      firstQuestion?.slice(0, 80) || `New ${therapeuticArea} conversation`;

    const sessionInput: Record<
      string,
      unknown
    > = {
      user_id: userId,
      therapeutic_area: therapeuticArea,
      title,
    };

    if (workspaceId) {
      sessionInput.workspace_id =
        workspaceId;
    }

    const { data, error } = await supabase
      .from("chat_sessions")
      .insert(sessionInput)
      .select()
      .single();

    if (error) {
      if (
        workspaceId &&
        isMissingSessionWorkspaceColumn(
          error
        )
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Workspace-linked conversations require the pending staging database migration.",
          },
          { status: 503 }
        );
      }

      throw new Error(error.message);
    }

    return NextResponse.json({
      ok: true,
      session:
        data.workspace_id ===
        undefined
          ? addLegacyWorkspaceField(
              data
            )
          : data,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to create session" },
      { status: 500 }
    );
  }
}

import { permitsTopic } from "../../../../lib/therapeuticAccess/scope";
import { NextRequest, NextResponse } from "next/server";
import { getChatAccess, restrictChatQuery } from "../../../../lib/chat/access";
import { getSupabaseServerClient } from "../../../../lib/supabase/server";
import {
  addLegacyWorkspaceField,
  isMissingSessionWorkspaceColumn,
} from "../../../../lib/chat/sessionCompatibility";
import { assertWorkspaceAccess, platformPrincipalFromEntitlements } from "../../../../lib/intelligence-platform";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const access = await getChatAccess();

    if (!access) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const supabase = getSupabaseServerClient();

    let { data, error } = await restrictChatQuery(supabase
      .from("chat_sessions")
      .select("id, workspace_id, therapeutic_area, title, created_at, updated_at"), access)
      .order("updated_at", { ascending: false });

    if (
      isMissingSessionWorkspaceColumn(
        error
      )
    ) {
      const legacyResult =
        await restrictChatQuery(supabase
          .from("chat_sessions")
          .select(
            "id, therapeutic_area, title, created_at, updated_at"
          ), access)
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
      { status: error?.status === 403 ? 403 : 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const access = await getChatAccess(true);

    if (!access) {
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

    if (!permitsTopic(access.topicScope, therapeuticArea)) {
      return NextResponse.json({ ok: false, error: "Topic access is required." }, { status: 403 });
    }
    const supabase = getSupabaseServerClient();

    if (workspaceId) {
      try {
        await assertWorkspaceAccess(platformPrincipalFromEntitlements(access), workspaceId, "editor");
      } catch (workspaceError: any) {
        return NextResponse.json({ ok: false, error: workspaceError.message || "Workspace access denied" }, { status: 403 });
      }
    }

    const title =
      firstQuestion?.slice(0, 80) || `New ${therapeuticArea} conversation`;

    const sessionInput: Record<
      string,
      unknown
    > = {
      user_id: access.userId,
      organization_id: access.chatOrganizationId || null,
      therapeutic_area: access.topicScope?.find(topic => permitsTopic([topic], therapeuticArea)) ?? therapeuticArea,
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
      { status: error?.status === 403 ? 403 : 500 }
    );
  }
}

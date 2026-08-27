import {
  clerkClient,
} from "@clerk/nextjs/server";
import {
  NextResponse,
} from "next/server";
import {
  withAdmin,
} from "../../../../lib/auth/isAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withAdmin(
  async (request) => {
    try {
      const url = new URL(request.url);
      const query = String(
        url.searchParams.get("query") || ""
      ).trim();
      const client =
        await clerkClient();
      const result =
        await client.users.getUserList({
          limit: 100,
          orderBy: "-created_at",
          ...(query ? { query } : {}),
        });

      const users = result.data
        .map((user) => {
          const email =
            user.primaryEmailAddress
              ?.emailAddress || "";
          const displayName =
            [
              user.firstName,
              user.lastName,
            ]
              .filter(Boolean)
              .join(" ") ||
            user.username ||
            email ||
            user.id;

          return {
            id: user.id,
            displayName,
            email,
            imageUrl:
              user.imageUrl || null,
          };
        })
        .sort((left, right) =>
          left.displayName.localeCompare(
            right.displayName,
            undefined,
            {
              sensitivity: "base",
            }
          )
        );

      return NextResponse.json({
        ok: true,
        users,
        totalCount:
          result.totalCount,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to load users";

      return NextResponse.json(
        { ok: false, error: message },
        { status: 500 }
      );
    }
  }
);

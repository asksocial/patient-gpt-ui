import {
  auth,
  clerkClient,
} from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

function objectValue(
  value: unknown
): Record<string, unknown> {
  return value &&
    typeof value === "object"
    ? (value as Record<
        string,
        unknown
      >)
    : {};
}

function normalizedRole(
  value: unknown
): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const role = value
    .trim()
    .toLowerCase();

  return role || undefined;
}

export function getRoleFromClaims(
  sessionClaims: unknown
): string | undefined {
  const claims = objectValue(
    sessionClaims
  );
  const metadataCandidates = [
    claims.publicMetadata,
    claims.public_metadata,
    claims.metadata,
  ];

  for (const metadata of
    metadataCandidates) {
    const role = normalizedRole(
      objectValue(metadata).role
    );

    if (role) return role;
  }

  return normalizedRole(claims.role);
}

export async function resolveAdminStatus({
  userId,
  sessionClaims,
  publicMetadata,
}: {
  userId: string | null | undefined;
  sessionClaims?: unknown;
  publicMetadata?: unknown;
}) {
  if (!userId) return false;

  if (publicMetadata !== undefined) {
    return (
      normalizedRole(
        objectValue(
          publicMetadata
        ).role
      ) === "admin"
    );
  }

  try {
    const client =
      await clerkClient();
    const user =
      await client.users.getUser(
        userId
      );

    return (
      normalizedRole(
        objectValue(
          user.publicMetadata
        ).role
      ) === "admin"
    );
  } catch (error) {
    console.error(
      "Unable to verify Clerk administrator role:",
      error
    );

    return (
      getRoleFromClaims(
        sessionClaims
      ) === "admin"
    );
  }
}

export async function isAdmin() {
  const { userId, sessionClaims } = await auth();

  return resolveAdminStatus({
    userId,
    sessionClaims,
  });
}

export async function requireAdmin() {
  const allowed = await isAdmin();

  if (!allowed) {
    throw new Error("Unauthorized");
  }
}

export function withAdmin<T extends (req: Request, ctx?: any) => Promise<Response>>(
  handler: T
) {
  return async (req: Request, ctx?: any) => {
    const allowed = await isAdmin();

    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return handler(req, ctx);
  };
}

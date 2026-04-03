import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

function getRoleFromClaims(sessionClaims: unknown): string | undefined {
  if (!sessionClaims || typeof sessionClaims !== "object") return undefined;

  const publicMetadata = (sessionClaims as { publicMetadata?: unknown }).publicMetadata;

  if (!publicMetadata || typeof publicMetadata !== "object") return undefined;

  const role = (publicMetadata as { role?: unknown }).role;

  return typeof role === "string" ? role : undefined;
}

export async function isAdmin() {
  const { userId, sessionClaims } = await auth();

  if (!userId) return false;

  return getRoleFromClaims(sessionClaims) === "admin";
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
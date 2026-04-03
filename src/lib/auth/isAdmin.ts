import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function isAdmin() {
  const { userId, sessionClaims } = await auth();

  if (!userId) return false;

  return sessionClaims?.publicMetadata?.role === "admin";
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
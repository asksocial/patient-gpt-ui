import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/auth/isAdmin";

export const GET = withAdmin(async () => {
  return NextResponse.json({
    ok: true,
    message: "Admin-only users endpoint",
  });
});

export const POST = withAdmin(async (req: Request) => {
  const body = await req.json();

  return NextResponse.json({
    ok: true,
    received: body,
  });
});
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { permitsManagedRequest } from "./lib/auth/provisioning/model";
import { readSessionAccess } from "./lib/auth/provisioning/session";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/ask(.*)",
  "/api/themes(.*)",
  "/api/therapeutic-areas(.*)",
  "/api/chat(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  const path = req.nextUrl.pathname;
  // Monitoring authenticates its scheduler bearer secret in the route handler.
  if (path === "/api/cron/monitoring") return;
  if (!isPublicRoute(req)) await auth.protect();

  // Clerk handles the hosted credential flow and account access recovery.
  if (path === "/" || path === "/account/access" || /^\/sign-(in|up)(\/|$)/.test(path)) return;
  const { userId, orgId } = await auth();
  if (!userId) return;
  try {
    const { access, account } = await readSessionAccess(userId, orgId);
    if (access !== "allowed") {
      return path.startsWith("/api/")
        ? NextResponse.json({ error: "Your account is unavailable in this organization." }, { status: 403 })
        : NextResponse.redirect(new URL("/account/access", req.url));
    }
    if (account && !permitsManagedRequest(account.account_role, path, req.method)) {
      return path.startsWith("/api/")
        ? NextResponse.json({ error: "Your account role does not allow this operation." }, { status: 403 })
        : NextResponse.redirect(new URL("/workspace", req.url));
    }
  } catch {
    return NextResponse.json({ error: "Account access could not be verified." }, { status: 503 });
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpg|jpeg|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
]);

const isAdminAccessRoute = createRouteMatcher([
  "/admin/access",
]);

const isAdminRoute = createRouteMatcher([
  "/admin(.*)",
]);

const isAdminApiRoute = createRouteMatcher([
  "/api/admin(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  const { userId, sessionClaims, redirectToSignIn } = await auth();

  const isSignedIn = !!userId;
  const isAdmin = sessionClaims?.publicMetadata?.role === "admin";

  // Keep your existing public-route behavior
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  // Require sign-in for everything else
  if (!isSignedIn) {
    return redirectToSignIn();
  }

  // /admin/access: signed-in only, but admins should not stay here
  if (isAdminAccessRoute(req)) {
    if (isAdmin) {
      return NextResponse.redirect(new URL("/admin", req.url));
    }

    return NextResponse.next();
  }

  // Lock all admin pages except /admin/access
  if (isAdminRoute(req) && !isAdminAccessRoute(req)) {
    if (!isAdmin) {
      return NextResponse.redirect(new URL("/admin/access", req.url));
    }

    return NextResponse.next();
  }

  // Lock all admin API routes
  if (isAdminApiRoute(req)) {
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.next();
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|jpeg|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
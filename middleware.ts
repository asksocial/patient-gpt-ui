import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  const { userId, redirectToSignIn } = await auth();

  const isSignedIn = !!userId;

  // Keep your existing public-route behavior
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  // Require sign-in for everything else
  if (!isSignedIn) {
    return redirectToSignIn();
  }

  // API handlers verify administrator roles against Clerk's authoritative
  // user metadata. Middleware only establishes that protected routes have
  // an authenticated user; this avoids relying on optional custom claims.
  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|jpeg|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/workspace",
  "/api/ask(.*)",
  "/api/themes/(.*)",
  "/api/therapeutic-areas(.*)",
  "/api/chat/(.*)",
  "/api/curated-insights(.*)", // important for curl testing
]);

export default clerkMiddleware((auth, req) => {
  if (!isPublicRoute(req)) {
    auth().protect();
  }
});

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware({
  publicRoutes: [
    "/", 
    "/api/ask",
    "/api/therapeutic-areas",
  ],
});

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
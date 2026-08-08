import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const client = await clerkClient();

  if (!orgId) {
    const user = await client.users.getUser(userId);
    return NextResponse.json({
      ok: true,
      users: [{
        userId: user.id,
        name: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || user.id,
        identifier: user.primaryEmailAddress?.emailAddress || user.id,
      }],
    });
  }

  const memberships = await client.organizations.getOrganizationMembershipList({
    organizationId: orgId,
    limit: 100,
  });
  return NextResponse.json({
    ok: true,
    users: memberships.data.map((membership) => ({
      userId: membership.publicUserData?.userId,
      name: [membership.publicUserData?.firstName, membership.publicUserData?.lastName].filter(Boolean).join(" ") || membership.publicUserData?.identifier,
      identifier: membership.publicUserData?.identifier,
    })).filter((user) => user.userId),
  });
}

import { UserButton } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { getSessionAccess } from "../../../lib/auth/provisioning/session";
import { ActivateOrganization } from "./ActivateOrganization";

export default async function AccountAccessPage() {
  const access = await getSessionAccess();
  if (!access) redirect("/");
  if (access.access === "allowed") redirect("/workspace");

  const organizationId = access.access === "organization_required" ? access.account?.organization_id : null;
  return (
    <main className="mx-auto mt-12 max-w-xl space-y-4 rounded-2xl border border-white/10 bg-white/[0.04] p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">AskSocial account access</h1>
        <UserButton />
      </div>
      {organizationId ? <ActivateOrganization organizationId={organizationId} /> : (
        <p>{access.access === "suspended" ? "Your AskSocial account is suspended." : "Your AskSocial access could not be verified."} Contact your administrator for help.</p>
      )}
    </main>
  );
}

import type {
  ReactNode,
} from "react";
import { redirect } from "next/navigation";
import {
  getCurrentEntitlements,
} from "../../lib/entitlements/server";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const entitlements =
    await getCurrentEntitlements();

  if (!entitlements) {
    redirect("/");
  }

  if (!entitlements.isAdmin) {
    redirect("/workspace");
  }

  return <div data-as-ui="admin">{children}<footer className="as-admin-footer">© 2026 Eavesdrop LLC. All rights reserved.</footer></div>;
}

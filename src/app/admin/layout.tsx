import Link from "next/link";
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

  return (
    <div data-as-ui="admin">
      <nav aria-label="Administration" className="flex flex-wrap gap-5 border-b px-6 py-3 text-sm">
        <Link href="/admin/entitlements">Entitlements</Link>
        <Link href="/admin/users">User Management</Link>
      </nav>
      {children}
      <footer className="as-admin-footer">© 2026 Eavesdrop LLC. All rights reserved.</footer>
    </div>
  );
}

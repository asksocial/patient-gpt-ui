"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { activityFetch as fetch } from "../../../lib/client/requestActivity";
import { ACCOUNT_ROLES, type AccountRole, type ManagedAccount } from "../../../lib/auth/provisioning/model";

type Directory = {
  accounts: ManagedAccount[];
  accountCount: number;
  organizations: { id: string; name: string }[];
  organizationCount: number;
  pageSize: number;
  topics: string[];
};

const endpoint = "/api/admin/user-provisioning";
const inputClass = "w-full rounded-lg border bg-white px-3 py-2";
const buttonClass = "rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50";
const labels = {
  pending: "Awaiting acceptance",
  active: "Active",
  suspended: "Suspended",
};

function AccessFields({ role, setRole, topics, selected, setSelected, platform }: {
  role: AccountRole;
  setRole: (role: AccountRole) => void;
  topics: string[];
  selected: string[];
  setSelected: (topics: string[]) => void;
  platform: "all" | "only" | "exclude";
}) {
  return (
    <>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Role</span>
        <select className={inputClass} value={role} onChange={event => setRole(event.target.value as AccountRole)}>
          {Object.entries(ACCOUNT_ROLES).filter(([key]) => platform === "all" || (key === "platform_admin") === (platform === "only"))
            .map(([key, name]) => <option key={key} value={key}>{name}</option>)}
        </select>
      </label>
      {role !== "platform_admin" && (
        <fieldset className="rounded-lg border p-3">
          <legend className="px-1 text-sm font-medium">Topic access</legend>
          {topics.length === 0 && <p className="text-sm">No active topics.</p>}
          <div className="grid gap-2 sm:grid-cols-2">
            {topics.map(topic => (
              <label key={topic} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={selected.includes(topic)}
                  onChange={event => setSelected(event.target.checked ? [...selected, topic] : selected.filter(item => item !== topic))} />
                {topic}
              </label>
            ))}
          </div>
        </fieldset>
      )}
    </>
  );
}

function AccountRow({ account, topics, busy, mutate }: {
  account: ManagedAccount;
  topics: string[];
  busy: boolean;
  mutate: (body: Record<string, unknown>) => Promise<boolean>;
}) {
  const [role, setRole] = useState(account.account_role);
  const [selected, setSelected] = useState(account.topics);
  const [confirmSuspend, setConfirmSuspend] = useState(false);
  const update = (action: string, fields: Record<string, unknown> = {}) =>
    mutate({ id: account.id, revision: account.revision, action, ...fields });

  return (
    <details className="rounded-lg border p-4">
      <summary className="cursor-pointer">
        <span className="font-medium">{account.email}</span>
        <span className="ml-3 text-sm text-white/65">{ACCOUNT_ROLES[account.account_role]} · {labels[account.state]}</span>
      </summary>
      <div className="mt-4 space-y-3">
        <p className="text-sm">Organization {account.organization_id || "Platform-wide"}</p>
        {account.state === "pending" && (
          <p className="text-sm">Invitation {account.delivery_state === "sent" ? "sent" : account.delivery_state}</p>
        )}
        {account.organization_id && (
          <form className="space-y-3" onSubmit={event => {
            event.preventDefault();
            void update("update_access", { role, topics: selected.filter(topic => topics.includes(topic)) });
          }}>
            <AccessFields role={role} setRole={setRole} topics={topics} selected={selected} setSelected={setSelected} platform="exclude" />
            <button className={buttonClass} disabled={busy}>Save access</button>
          </form>
        )}
        <div className="flex flex-wrap gap-2">
          {account.state === "pending" && <button className={buttonClass} disabled={busy} onClick={() => void update("resend")}>Resend or retry invitation</button>}
          {account.state === "active" && !confirmSuspend && <button className={buttonClass} disabled={busy} onClick={() => setConfirmSuspend(true)}>Suspend account</button>}
          {account.state === "active" && confirmSuspend && <>
            <button className={buttonClass} disabled={busy} onClick={() => void update("suspend")}>Confirm suspension</button>
            <button className={buttonClass} disabled={busy} onClick={() => setConfirmSuspend(false)}>Cancel</button>
          </>}
          {account.state === "suspended" && <button className={buttonClass} disabled={busy} onClick={() => void update("restore")}>Restore access</button>}
        </div>
      </div>
    </details>
  );
}

export default function UserManagementPage() {
  const [directory, setDirectory] = useState<Directory | null>(null);
  const [page, setPage] = useState(0);
  const [organizationId, setOrganizationId] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AccountRole>("client_analyst");
  const [topics, setTopics] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch(`${endpoint}?page=${page}`, { cache: "no-store", signal });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "User management could not be loaded.");
    setDirectory(result);
  }, [page]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal).catch(error => {
      if (!controller.signal.aborted) setNotice(error.message || "User management could not be loaded.");
    });
    return () => controller.abort();
  }, [load]);

  async function mutate(body: Record<string, unknown>, method = "PATCH") {
    setBusy(true);
    setNotice("");
    let succeeded = false;
    try {
      const response = await fetch(endpoint, {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The account change could not be saved.");
      succeeded = true;
      setNotice(result.account.state === "pending" && result.account.delivery_state === "sent"
        ? "Invitation sent. Access starts after acceptance." : "Account saved.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The account change could not be saved.");
    }
    try {
      await load();
    } catch {
      setNotice(previous => `${previous} Refresh the page to reload the directory.`.trim());
    } finally {
      setBusy(false);
    }
    return succeeded;
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await mutate({
      email, role, organizationId: role === "platform_admin" ? null : organizationId,
      topics: role === "platform_admin" ? [] : topics,
    }, "POST")) {
      setEmail("");
      setTopics([]);
    }
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <h1 className="text-3xl font-semibold">User Management</h1>
      <p role="status" className="text-sm" aria-live="polite">{notice}</p>
      {directory ? (
        <>
          <section className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <h2 className="text-xl font-semibold">Provision access</h2>
            <p className="text-sm text-white/65">Clerk emails new users an invitation to set up their account. Existing verified members of the selected organization can be assigned access directly.</p>
            <form className="space-y-4" onSubmit={create}>
              <label className="block">
                <span className="mb-1 block text-sm font-medium">Email</span>
                <input className={inputClass} type="email" autoComplete="off" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} />
              </label>
              <AccessFields role={role} setRole={setRole} topics={directory.topics} selected={topics} setSelected={setTopics} platform="all" />
              {role !== "platform_admin" && (
                <label className="block">
                  <span className="mb-1 block text-sm font-medium">Organization</span>
                  <input className={inputClass} list="managed-organizations" required value={organizationId} onChange={event => setOrganizationId(event.target.value)} placeholder="Select or enter a Clerk organization ID" />
                  <datalist id="managed-organizations">{directory.organizations.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}</datalist>
                </label>
              )}
              <button className={buttonClass} disabled={busy}>Provision account</button>
            </form>
          </section>
          <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <h2 className="text-xl font-semibold">Managed accounts</h2>
            {!directory.accounts.length && <p className="text-sm">No managed accounts on this page.</p>}
            {directory.accounts.map(account => (
              <AccountRow key={`${account.id}:${account.revision}`} account={account} topics={directory.topics} busy={busy} mutate={mutate} />
            ))}
            <div className="flex items-center gap-3">
              <button className={buttonClass} disabled={page === 0 || busy} onClick={() => setPage(page - 1)}>Previous</button>
              <span className="text-sm">Page {page + 1}</span>
              <button className={buttonClass} disabled={(page + 1) * directory.pageSize >= Math.max(directory.accountCount, directory.organizationCount) || busy} onClick={() => setPage(page + 1)}>Next</button>
            </div>
          </section>
        </>
      ) : !notice && <p>Loading accounts…</p>}
    </main>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";

function Panel({ children, className = "" }) {
  return <section className={`rounded-2xl border border-white/10 bg-white/[0.03] p-5 ${className}`}>{children}</section>;
}

function ProductDetail({ product, onClose }) {
  if (!product) return null;
  const payload = product.payload || {};
  const summary = payload.directAnswer || payload.summary || payload.analyticalAnswer?.directAnswer || payload.answer?.directAnswer;
  return (
    <Panel>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-white/40">{product.kind} · {product.status}</p>
          <h3 className="mt-2 text-lg font-semibold text-white">{product.title}</h3>
          <p className="mt-1 text-xs text-white/35">{product.therapeutic_area || "Cross-therapeutic"} · {new Date(product.created_at).toLocaleString()}</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-xl border border-white/10 px-3 py-2 text-xs text-white/60">Close</button>
      </div>
      {summary ? <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-white/70">{typeof summary === "string" ? summary : JSON.stringify(summary, null, 2)}</p> : null}
      <details className="mt-5 rounded-xl border border-white/10 bg-black/30 p-4">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.14em] text-white/45">Complete saved payload</summary>
        <pre className="mt-4 max-h-[32rem] overflow-auto whitespace-pre-wrap text-xs leading-5 text-white/55">{JSON.stringify(payload, null, 2)}</pre>
      </details>
    </Panel>
  );
}

export default function WorkspaceManager({
  workspaces,
  activeWorkspaceId,
  therapeuticAreas,
  onSelectWorkspace,
  onWorkspaceCreated,
  onWorkspaceUpdated,
  onWorkspaceDeleted,
}) {
  const initialWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId) || workspaces[0] || null;
  const [selectedId, setSelectedId] = useState(initialWorkspace?.id || "");
  const [products, setProducts] = useState([]);
  const [members, setMembers] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(Boolean(initialWorkspace));
  const [showArchived, setShowArchived] = useState(false);
  const [newName, setNewName] = useState("");
  const [memberUserId, setMemberUserId] = useState("");
  const [memberRole, setMemberRole] = useState("viewer");
  const [candidateUsers, setCandidateUsers] = useState([]);

  const visibleWorkspaces = useMemo(
    () => workspaces.filter((workspace) => showArchived || !workspace.archivedAt),
    [showArchived, workspaces]
  );
  const selected = workspaces.find((workspace) => workspace.id === selectedId) || null;
  const [draft, setDraft] = useState({
    name: initialWorkspace?.name || "",
    description: initialWorkspace?.description || "",
    therapeuticArea: initialWorkspace?.therapeuticArea || "",
    moduleIds: initialWorkspace?.moduleIds || [],
  });

  function chooseWorkspace(workspace) {
    setLoading(true);
    setSelectedId(workspace.id);
    setDraft({
      name: workspace.name || "",
      description: workspace.description || "",
      therapeuticArea: workspace.therapeuticArea || "",
      moduleIds: workspace.moduleIds || [],
    });
    setSelectedProduct(null);
  }

  useEffect(() => {
    if (!selected) return;
    Promise.all([
      fetch(`/api/work-products?workspaceId=${encodeURIComponent(selected.id)}`, { cache: "no-store" }).then((response) => response.json()),
      fetch(`/api/workspaces/members?workspaceId=${encodeURIComponent(selected.id)}`, { cache: "no-store" }).then((response) => response.json()),
    ]).then(([productData, memberData]) => {
      if (productData.ok) setProducts(productData.products || []);
      else setMessage(productData.error || "Unable to load workspace content.");
      if (memberData.ok) setMembers(memberData.members || []);
      else setMessage((current) => current || memberData.error || "Unable to load workspace members.");
    }).catch(() => {
      setMessage("Unable to load workspace content. Reload to try again.");
    }).finally(() => setLoading(false));
  }, [selected]);

  useEffect(() => {
    fetch("/api/workspaces/candidates", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (data.ok) setCandidateUsers(data.users || []);
      })
      .catch(() => setCandidateUsers([]));
  }, []);

  function memberLabel(userId) {
    const user = candidateUsers.find((candidate) => candidate.userId === userId);
    return user ? `${user.name} · ${user.identifier}` : userId;
  }

  async function createWorkspace(event) {
    event.preventDefault();
    if (!newName.trim()) return;
    const response = await fetch("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    const data = await response.json();
    if (!data.ok) return setMessage(data.error || "Unable to create workspace.");
    setNewName("");
    onWorkspaceCreated(data.workspace);
    chooseWorkspace(data.workspace);
    await onSelectWorkspace(data.workspace.id);
    setMessage("Workspace created and selected.");
  }

  async function updateWorkspace(updates) {
    if (!selected) return;
    const response = await fetch("/api/workspaces", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId: selected.id, ...updates }),
    });
    const data = await response.json();
    if (!data.ok) return setMessage(data.error || "Unable to update workspace.");
    onWorkspaceUpdated(data.workspace);
    setMessage("Workspace changes saved.");
  }

  async function deleteWorkspace() {
    if (!selected || !window.confirm(`Permanently delete “${selected.name}” and all of its saved work?`)) return;
    const response = await fetch(`/api/workspaces?workspaceId=${encodeURIComponent(selected.id)}`, { method: "DELETE" });
    const data = await response.json();
    if (!data.ok) return setMessage(data.error || "Unable to delete workspace.");
    onWorkspaceDeleted(selected.id);
    setSelectedId("");
    setProducts([]);
    setMembers([]);
    setMessage("Workspace permanently deleted.");
  }

  async function saveMember(event) {
    event.preventDefault();
    const response = await fetch("/api/workspaces/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId: selected.id, userId: memberUserId, role: memberRole }),
    });
    const data = await response.json();
    if (!data.ok) return setMessage(data.error || "Unable to save member.");
    setMemberUserId("");
    const refreshed = await fetch(`/api/workspaces/members?workspaceId=${encodeURIComponent(selected.id)}`, { cache: "no-store" }).then((item) => item.json());
    if (refreshed.ok) setMembers(refreshed.members || []);
    setMessage("Workspace member saved.");
  }

  async function removeMember(userId) {
    const response = await fetch(`/api/workspaces/members?workspaceId=${encodeURIComponent(selected.id)}&userId=${encodeURIComponent(userId)}`, { method: "DELETE" });
    const data = await response.json();
    if (!data.ok) return setMessage(data.error || "Unable to remove member.");
    setMembers((current) => current.filter((member) => member.userId !== userId));
    setMessage("Workspace member removed.");
  }

  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <h2 className="text-lg font-semibold text-white">Workspace manager</h2>
            <p className="mt-1 text-sm text-white/45">Create governed spaces, organize saved intelligence, and control access.</p>
          </div>
          <form onSubmit={createWorkspace} className="flex gap-2">
            <input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="New workspace name" className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none" />
            <button type="submit" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black">Create</button>
          </form>
        </div>
      </Panel>

      {message ? <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/60">{message}</p> : null}

      <div className="grid gap-4 xl:grid-cols-[18rem_1fr]">
        <Panel>
          <label className="flex items-center justify-between text-xs text-white/45">
            <span className="font-semibold uppercase tracking-[0.14em]">Workspaces</span>
            <span><input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} /> Archived</span>
          </label>
          <div className="mt-4 space-y-2">
            {visibleWorkspaces.map((workspace) => (
              <button key={workspace.id} type="button" onClick={() => chooseWorkspace(workspace)} className={`w-full rounded-xl border p-3 text-left ${workspace.id === selectedId ? "border-white/30 bg-white/10" : "border-white/10 bg-black/20"}`}>
                <span className="block text-sm font-medium text-white/80">{workspace.name}</span>
                <span className="mt-1 block text-xs text-white/35">{workspace.role} · {workspace.archivedAt ? "Archived" : "Active"}</span>
              </button>
            ))}
            {!visibleWorkspaces.length ? <p className="text-sm text-white/35">No workspaces available.</p> : null}
          </div>
        </Panel>

        <div className="space-y-4">
          {selected ? (
            <>
              <Panel>
                <div className="grid gap-3 md:grid-cols-2">
                  <input value={draft.name} disabled={selected.role === "viewer"} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Workspace name" className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white" />
                  <select value={draft.therapeuticArea} disabled={selected.role === "viewer"} onChange={(event) => setDraft((current) => ({ ...current, therapeuticArea: event.target.value }))} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white">
                    <option value="">Cross-therapeutic</option>
                    {therapeuticAreas.map((area) => <option key={area} value={area}>{area}</option>)}
                  </select>
                  <textarea value={draft.description} disabled={selected.role === "viewer"} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Workspace description" rows={3} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white md:col-span-2" />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {selected.role !== "viewer" ? <button type="button" onClick={() => updateWorkspace(draft)} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black">Save changes</button> : null}
                  {selected.role !== "viewer" && !selected.archivedAt ? (
                    <button type="button" onClick={async () => { await onSelectWorkspace(selected.id); setMessage("Workspace selected for new work."); }} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/70">Use workspace</button>
                  ) : null}
                  {selected.role === "viewer" ? <p className="self-center text-xs text-white/35">View-only access</p> : null}
                  {selected.role === "owner" ? <button type="button" onClick={() => updateWorkspace({ archived: !selected.archivedAt })} className="rounded-xl border border-amber-400/20 px-4 py-2 text-sm text-amber-200/70">{selected.archivedAt ? "Restore" : "Archive"}</button> : null}
                  {selected.role === "owner" ? <button type="button" onClick={deleteWorkspace} className="rounded-xl border border-rose-400/20 px-4 py-2 text-sm text-rose-200/70">Delete permanently</button> : null}
                </div>
              </Panel>

              <Panel>
                <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-white/70">Saved intelligence</h3>
                {loading ? <p className="mt-3 text-sm text-white/35">Loading workspace…</p> : null}
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {products.map((product) => (
                    <button key={product.id} type="button" onClick={() => setSelectedProduct(product)} className="rounded-xl border border-white/10 bg-black/20 p-3 text-left hover:border-white/25">
                      <span className="text-xs uppercase text-white/35">{product.kind}</span>
                      <span className="mt-1 block text-sm font-medium text-white/75">{product.title}</span>
                    </button>
                  ))}
                  {!loading && !products.length ? <p className="text-sm text-white/35">No saved work yet.</p> : null}
                </div>
              </Panel>

              {selectedProduct ? <ProductDetail product={selectedProduct} onClose={() => setSelectedProduct(null)} /> : null}

              <Panel>
                <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-white/70">Members and permissions</h3>
                <div className="mt-4 space-y-2">
                  {members.map((member) => (
                    <div key={member.userId} className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-2">
                      <div><p className="text-sm text-white/70">{memberLabel(member.userId)}</p><p className="text-xs text-white/35">{member.role}</p></div>
                      {selected.role === "owner" ? <button type="button" onClick={() => removeMember(member.userId)} className="text-xs text-rose-300/70">Remove</button> : null}
                    </div>
                  ))}
                </div>
                {selected.role === "owner" ? (
                  <form onSubmit={saveMember} className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <select value={memberUserId} onChange={(event) => setMemberUserId(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white">
                      <option value="">Select an organization user</option>
                      {candidateUsers.map((user) => <option key={user.userId} value={user.userId}>{user.name} · {user.identifier}</option>)}
                    </select>
                    <select value={memberRole} onChange={(event) => setMemberRole(event.target.value)} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"><option value="viewer">Viewer</option><option value="editor">Editor</option><option value="owner">Owner</option></select>
                    <button type="submit" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black">Add or update</button>
                  </form>
                ) : null}
              </Panel>
            </>
          ) : <Panel><p className="text-sm text-white/40">Choose or create a workspace to begin.</p></Panel>}
        </div>
      </div>
    </div>
  );
}

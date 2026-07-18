"use client";

import {
  useEffect,
  useState,
} from "react";

type CatalogItem = {
  key: string;
  label: string;
  description: string;
  defaultGranted: boolean;
};

type AccessState =
  | "inherit"
  | "grant"
  | "deny";

export default function EntitlementsAdminPage() {
  const [catalog, setCatalog] =
    useState<CatalogItem[]>([]);
  const [subjectType, setSubjectType] =
    useState("user");
  const [subjectId, setSubjectId] =
    useState("");
  const [displayName, setDisplayName] =
    useState("");
  const [states, setStates] =
    useState<Record<string, AccessState>>(
      {}
    );
  const [loading, setLoading] =
    useState(false);
  const [message, setMessage] =
    useState("");

  useEffect(() => {
    fetch("/api/admin/entitlements")
      .then((response) =>
        response.json()
      )
      .then((data) =>
        setCatalog(
          data.catalog || []
        )
      )
      .catch(() =>
        setMessage(
          "Failed to load entitlement catalog."
        )
      );
  }, []);

  async function loadSubject() {
    if (!subjectId.trim()) return;
    setLoading(true);
    setMessage("");

    try {
      const params =
        new URLSearchParams({
          subjectType,
          subjectId:
            subjectId.trim(),
        });
      const response = await fetch(
        `/api/admin/entitlements?${params}`
      );
      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to load subject"
        );
      }

      const grants = new Set(
        data.subject
          .entitlementMetadata
          .grants || []
      );
      const denials = new Set(
        data.subject
          .entitlementMetadata
          .denials || []
      );
      setDisplayName(
        data.subject.displayName
      );
      setStates(
        Object.fromEntries(
          (data.catalog || []).map(
            (item: CatalogItem) => [
              item.key,
              grants.has(item.key)
                ? "grant"
                : denials.has(
                      item.key
                    )
                  ? "deny"
                  : "inherit",
            ]
          )
        )
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Failed to load subject"
      );
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(
        "/api/admin/entitlements",
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            subjectType,
            subjectId:
              subjectId.trim(),
            entitlements: {
              grants: Object.entries(
                states
              )
                .filter(
                  ([, state]) =>
                    state === "grant"
                )
                .map(([key]) => key),
              denials: Object.entries(
                states
              )
                .filter(
                  ([, state]) =>
                    state === "deny"
                )
                .map(([key]) => key),
            },
          }),
        }
      );
      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to save entitlements"
        );
      }

      setMessage(
        "Entitlements saved. Active sessions may need to refresh before user-level metadata changes appear."
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Failed to save entitlements"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
          AskSocial Admin
        </p>
        <h1 className="mt-3 text-3xl font-semibold">
          Capability Entitlements
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-white/55">
          Configure organization-level product access or user-level overrides. User settings take precedence over organization settings, which take precedence over platform defaults.
        </p>

        <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <div className="grid gap-4 md:grid-cols-[180px_1fr_auto]">
            <select
              value={subjectType}
              onChange={(event) => {
                setSubjectType(
                  event.target.value
                );
                setDisplayName("");
                setStates({});
              }}
              className="rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm"
            >
              <option value="user">
                User
              </option>
              <option value="organization">
                Organization
              </option>
            </select>
            <input
              value={subjectId}
              onChange={(event) =>
                setSubjectId(
                  event.target.value
                )
              }
              placeholder={
                subjectType === "user"
                  ? "user_..."
                  : "org_..."
              }
              className="rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm outline-none focus:border-white/30"
            />
            <button
              type="button"
              onClick={loadSubject}
              disabled={
                loading ||
                !subjectId.trim()
              }
              className="rounded-2xl bg-white px-5 py-3 text-sm font-medium text-black disabled:opacity-50"
            >
              {loading
                ? "Loading..."
                : "Load access"}
            </button>
          </div>
        </section>

        {displayName ? (
          <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <div className="flex flex-col gap-2 border-b border-white/10 pb-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-white/35">
                  Editing
                </p>
                <h2 className="mt-1 text-xl font-semibold">
                  {displayName}
                </h2>
              </div>
              <button
                type="button"
                onClick={save}
                disabled={loading}
                className="rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-medium text-black disabled:opacity-50"
              >
                Save entitlements
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {catalog.map((item) => (
                <div
                  key={item.key}
                  className="grid gap-4 rounded-2xl border border-white/10 bg-black/30 p-4 md:grid-cols-[1fr_340px] md:items-center"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium">
                        {item.label}
                      </h3>
                      <span className="rounded-full bg-white/10 px-2 py-1 text-[11px] text-white/45">
                        Default {item.defaultGranted ? "on" : "off"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-white/45">
                      {item.description}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 rounded-xl border border-white/10 bg-black p-1">
                    {(["inherit", "grant", "deny"] as AccessState[]).map(
                      (state) => (
                        <button
                          key={state}
                          type="button"
                          onClick={() =>
                            setStates(
                              (current) => ({
                                ...current,
                                [item.key]: state,
                              })
                            )
                          }
                          className={`rounded-lg px-3 py-2 text-xs font-medium capitalize transition ${
                            states[item.key] === state
                              ? state === "grant"
                                ? "bg-emerald-400 text-black"
                                : state === "deny"
                                  ? "bg-rose-400 text-black"
                                  : "bg-white text-black"
                              : "text-white/45 hover:text-white"
                          }`}
                        >
                          {state}
                        </button>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {message ? (
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/70">
            {message}
          </div>
        ) : null}
      </div>
    </main>
  );
}

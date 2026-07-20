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
  const [
    therapeuticAreaCatalog,
    setTherapeuticAreaCatalog,
  ] = useState<string[]>([]);
  const [
    therapeuticAreas,
    setTherapeuticAreas,
  ] = useState<string[]>([]);
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
    async function loadCatalog() {
      try {
        const response = await fetch(
          "/api/admin/entitlements"
        );
        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
              "Failed to load entitlement catalog."
          );
        }

        const nextCatalog =
          Array.isArray(data.catalog)
            ? data.catalog
            : [];

        if (!nextCatalog.length) {
          throw new Error(
            "No assignable entitlements were returned."
          );
        }

        setCatalog(nextCatalog);
        setTherapeuticAreaCatalog(
          Array.isArray(
            data.therapeuticAreaCatalog
          )
            ? data.therapeuticAreaCatalog
            : []
        );
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Failed to load entitlement catalog."
        );
      }
    }

    loadCatalog();
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
      setCatalog(
        Array.isArray(data.catalog)
          ? data.catalog
          : []
      );
      setTherapeuticAreaCatalog(
        Array.isArray(
          data.therapeuticAreaCatalog
        )
          ? data.therapeuticAreaCatalog
          : []
      );
      setTherapeuticAreas(
        subjectType === "user" &&
          Array.isArray(
            data.subject
              .therapeuticAreas
          )
          ? data.subject
              .therapeuticAreas
          : []
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
            ...(subjectType === "user"
              ? {
                  therapeuticAreas,
                }
              : {}),
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
        subjectType === "user"
          ? "Therapeutic areas and entitlements saved."
          : "Organization entitlements saved."
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
          User Access Administration
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-white/55">
          Assign therapeutic areas and product capabilities from one screen. User settings take precedence over organization settings, which take precedence over platform defaults.
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
                setTherapeuticAreas(
                  []
                );
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
              onChange={(event) => {
                setSubjectId(
                  event.target.value
                );
                setDisplayName("");
                setStates({});
                setTherapeuticAreas(
                  []
                );
              }}
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

        <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          {displayName ? (
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
                Save access
              </button>
            </div>
          ) : (
            <div className="border-b border-white/10 pb-5">
              <p className="text-xs uppercase tracking-[0.16em] text-white/35">
                Available entitlements
              </p>
              <h2 className="mt-1 text-xl font-semibold">
                Assignable capabilities
              </h2>
              <p className="mt-2 text-sm leading-6 text-white/50">
                Load a user or organization above to grant, deny, or inherit these capabilities.
              </p>
            </div>
          )}

          {displayName &&
          subjectType === "user" ? (
            <div className="mt-5 border-b border-white/10 pb-5">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-white/35">
                  Therapeutic area access
                </p>
                <h3 className="mt-1 text-lg font-semibold">
                  Assigned intelligence areas
                </h3>
                <p className="mt-1 text-sm leading-6 text-white/45">
                  Select every therapeutic area this user should be able to access.
                </p>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {therapeuticAreaCatalog.length ? (
                  therapeuticAreaCatalog.map(
                    (area) => {
                      const checked =
                        therapeuticAreas.includes(
                          area
                        );

                      return (
                        <label
                          key={area}
                          className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition ${
                            checked
                              ? "border-cyan-300/40 bg-cyan-300/10"
                              : "border-white/10 bg-black/30 hover:border-white/20"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={loading}
                            onChange={(
                              event
                            ) =>
                              setTherapeuticAreas(
                                (current) =>
                                  event.target
                                    .checked
                                    ? [
                                        ...current,
                                        area,
                                      ]
                                    : current.filter(
                                        (
                                          currentArea
                                        ) =>
                                          currentArea !==
                                          area
                                      )
                              )
                            }
                            className="size-4 accent-cyan-300"
                          />
                          <span className="text-sm font-medium">
                            {area}
                          </span>
                        </label>
                      );
                    }
                  )
                ) : (
                  <p className="text-sm text-white/45">
                    No active therapeutic areas are available.
                  </p>
                )}
              </div>
            </div>
          ) : null}

          <div className="mt-5 space-y-3">
            {catalog.length ? (
              catalog.map((item) => (
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
                          disabled={
                            !displayName ||
                            loading
                          }
                          onClick={() =>
                            setStates(
                              (current) => ({
                                ...current,
                                [item.key]: state,
                              })
                            )
                          }
                          className={`rounded-lg px-3 py-2 text-xs font-medium capitalize transition disabled:cursor-not-allowed disabled:opacity-45 ${
                            (states[item.key] || "inherit") === state
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
              ))
            ) : (
              <p className="text-sm text-white/45">
                Loading available entitlements...
              </p>
            )}
          </div>
        </section>

        {message ? (
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/70">
            {message}
          </div>
        ) : null}
      </div>
    </main>
  );
}

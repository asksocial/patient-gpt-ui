"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

type CatalogItem = {
  key: string;
  label: string;
  description: string;
  defaultGranted: boolean;
};

type AdminUser = {
  id: string;
  displayName: string;
  email: string;
};

type AccessState =
  | "inherit"
  | "grant"
  | "deny";

type EffectiveCapability = {
  granted: boolean;
  source?: string;
};

const MODULE_KEYS = [
  "module_advocacy",
  "module_clinical_trials",
  "module_commercial",
  "module_competitive",
  "module_corporate_affairs",
  "module_medical_affairs",
  "module_patient",
] as const;

const PV_ENTITLEMENT_KEY =
  "agent_pharmacovigilance_assistant";

const PRIMARY_ACCESS_KEYS = new Set([
  ...MODULE_KEYS,
  PV_ENTITLEMENT_KEY,
]);

function AccessSelector({
  value,
  disabled,
  onChange,
}: {
  value: AccessState;
  disabled: boolean;
  onChange: (state: AccessState) => void;
}) {
  return (
    <div className="grid grid-cols-3 rounded-xl border border-white/10 bg-black p-1">
      {(["inherit", "grant", "deny"] as AccessState[]).map(
        (state) => (
          <button
            key={state}
            type="button"
            disabled={disabled}
            onClick={() => onChange(state)}
            className={`rounded-lg px-3 py-2 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-45 ${
              value === state
                ? state === "grant"
                  ? "bg-emerald-400 text-black"
                  : state === "deny"
                    ? "bg-rose-400 text-black"
                    : "bg-white text-black"
                : "text-white/45 hover:text-white"
            }`}
          >
            {state === "grant"
              ? "Enable"
              : state === "deny"
                ? "Disable"
                : "Inherit"}
          </button>
        )
      )}
    </div>
  );
}

function CapabilityCard({
  item,
  state,
  effective,
  disabled,
  onChange,
}: {
  item: CatalogItem;
  state: AccessState;
  effective?: EffectiveCapability;
  disabled: boolean;
  onChange: (state: AccessState) => void;
}) {
  const effectiveGranted =
    state === "grant"
      ? true
      : state === "deny"
        ? false
        : effective?.granted ?? item.defaultGranted;

  return (
    <div
      className={`grid gap-4 rounded-2xl border p-4 md:grid-cols-[1fr_300px] md:items-center ${
        effectiveGranted
          ? "border-cyan-300/25 bg-cyan-300/[0.06]"
          : "border-white/10 bg-black/30"
      }`}
    >
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-medium">{item.label}</h3>
          <span
            className={`rounded-full px-2 py-1 text-[11px] ${
              effectiveGranted
                ? "bg-cyan-300/10 text-cyan-200"
                : "bg-white/10 text-white/45"
            }`}
          >
            Effective {effectiveGranted ? "on" : "off"}
          </span>
        </div>
        <p className="mt-1 text-sm leading-6 text-white/45">
          {item.description}
        </p>
      </div>
      <AccessSelector
        value={state}
        disabled={disabled}
        onChange={onChange}
      />
    </div>
  );
}

export default function EntitlementsAdminPage() {
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [userQuery, setUserQuery] = useState("");
  const [therapeuticAreaCatalog, setTherapeuticAreaCatalog] =
    useState<string[]>([]);
  const [therapeuticAreas, setTherapeuticAreas] =
    useState<string[]>([]);
  const [subjectType, setSubjectType] = useState("user");
  const [subjectId, setSubjectId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [states, setStates] =
    useState<Record<string, AccessState>>({});
  const [effectiveCapabilities, setEffectiveCapabilities] =
    useState<Record<string, EffectiveCapability>>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const modules = useMemo(
    () =>
      MODULE_KEYS.map((key) =>
        catalog.find((item) => item.key === key)
      ).filter((item): item is CatalogItem => !!item),
    [catalog]
  );
  const pvCapability = useMemo(
    () =>
      catalog.find(
        (item) => item.key === PV_ENTITLEMENT_KEY
      ),
    [catalog]
  );
  const advancedCapabilities = useMemo(
    () =>
      catalog.filter(
        (item) => !PRIMARY_ACCESS_KEYS.has(item.key)
      ),
    [catalog]
  );

  function resetSubject() {
    setDisplayName("");
    setStates({});
    setEffectiveCapabilities({});
    setTherapeuticAreas([]);
    setMessage("");
  }

  useEffect(() => {
    async function loadAdministrationData() {
      const [catalogResult, userResult] = await Promise.allSettled([
        fetch("/api/admin/entitlements").then(async (response) => {
          const data = await response.json();
          if (!response.ok) {
            throw new Error(
              data.error || "Failed to load access catalog."
            );
          }
          return data;
        }),
        fetch("/api/admin/users").then(async (response) => {
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.error || "Failed to load users.");
          }
          return data;
        }),
      ]);

      if (catalogResult.status === "fulfilled") {
        const data = catalogResult.value;
        const nextCatalog = Array.isArray(data.catalog)
          ? data.catalog
          : [];

        if (!nextCatalog.length) {
          setMessage("No assignable entitlements were returned.");
        } else {
          setCatalog(nextCatalog);
          setTherapeuticAreaCatalog(
            Array.isArray(data.therapeuticAreaCatalog)
              ? data.therapeuticAreaCatalog
              : []
          );
        }
      } else {
        setMessage(
          catalogResult.reason instanceof Error
            ? catalogResult.reason.message
            : "Failed to load access catalog."
        );
      }

      if (userResult.status === "fulfilled") {
        setUsers(
          Array.isArray(userResult.value.users)
            ? userResult.value.users
            : []
        );
      } else {
        setMessage(
          (current) =>
            current ||
            (userResult.reason instanceof Error
              ? userResult.reason.message
              : "Failed to load users.")
        );
      }

      setUsersLoading(false);
    }

    loadAdministrationData();
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(
      async () => {
        setUsersLoading(true);
        try {
          const params = new URLSearchParams({
            query: userQuery.trim(),
          });
          const response = await fetch(
            `/api/admin/users?${params}`
          );
          const data = await response.json();
          if (!response.ok) {
            throw new Error(
              data.error || "Failed to search users."
            );
          }
          setUsers(
            Array.isArray(data.users) ? data.users : []
          );
        } catch (error) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Failed to search users."
          );
        } finally {
          setUsersLoading(false);
        }
      },
      300
    );

    return () => window.clearTimeout(timeout);
  }, [userQuery]);

  async function loadSubject() {
    if (!subjectId.trim()) return;
    setLoading(true);
    setMessage("");

    try {
      const params = new URLSearchParams({
        subjectType,
        subjectId: subjectId.trim(),
      });
      const response = await fetch(
        `/api/admin/entitlements?${params}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load access");
      }

      const grants = new Set(
        data.subject.entitlementMetadata.grants || []
      );
      const denials = new Set(
        data.subject.entitlementMetadata.denials || []
      );
      const nextCatalog = Array.isArray(data.catalog)
        ? data.catalog
        : [];

      setDisplayName(data.subject.displayName);
      setCatalog(nextCatalog);
      setTherapeuticAreaCatalog(
        Array.isArray(data.therapeuticAreaCatalog)
          ? data.therapeuticAreaCatalog
          : []
      );
      setTherapeuticAreas(
        subjectType === "user" &&
          Array.isArray(data.subject.therapeuticAreas)
          ? data.subject.therapeuticAreas
          : []
      );
      setStates(
        Object.fromEntries(
          nextCatalog.map((item: CatalogItem) => [
            item.key,
            grants.has(item.key)
              ? "grant"
              : denials.has(item.key)
                ? "deny"
                : "inherit",
          ])
        )
      );
      setEffectiveCapabilities(
        data.effectivePreview?.capabilities || {}
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Failed to load access"
      );
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!displayName) return;
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/entitlements", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectType,
          subjectId: subjectId.trim(),
          ...(subjectType === "user" ? { therapeuticAreas } : {}),
          entitlements: {
            grants: Object.entries(states)
              .filter(([, state]) => state === "grant")
              .map(([key]) => key),
            denials: Object.entries(states)
              .filter(([, state]) => state === "deny")
              .map(([key]) => key),
          },
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save access");
      }

      setEffectiveCapabilities(
        Object.fromEntries(
          catalog.map((item) => [
            item.key,
            {
              granted:
                states[item.key] === "grant"
                  ? true
                  : states[item.key] === "deny"
                    ? false
                    : effectiveCapabilities[item.key]?.granted ??
                      item.defaultGranted,
              source:
                states[item.key] === "inherit"
                  ? effectiveCapabilities[item.key]?.source
                  : subjectType,
            },
          ])
        )
      );
      setMessage(
        subjectType === "user"
          ? "Therapeutic areas, modules, PV Compliance, and access capabilities saved."
          : "Organization access capabilities saved."
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Failed to save access"
      );
    } finally {
      setLoading(false);
    }
  }

  const assignmentDisabled = !displayName || loading;

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
          AskSocial Admin
        </p>
        <h1 className="mt-3 text-3xl font-semibold">
          User Access Administration
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-white/55">
          Select a user, then assign their therapeutic areas, licensed modules, and PV Compliance access from one governed screen. User settings take precedence over organization settings and platform defaults.
        </p>

        <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              loadSubject();
            }}
            className="grid gap-4 md:grid-cols-[180px_1fr_auto]"
          >
            <select
              aria-label="Access subject type"
              value={subjectType}
              onChange={(event) => {
                setSubjectType(event.target.value);
                setSubjectId("");
                resetSubject();
              }}
              className="cursor-pointer rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm"
            >
              <option value="user">User</option>
              <option value="organization">Organization</option>
            </select>

            {subjectType === "user" ? (
              <div className="grid gap-2 sm:grid-cols-[minmax(180px,0.7fr)_minmax(240px,1fr)]">
                <input
                  aria-label="Search users"
                  value={userQuery}
                  onChange={(event) => {
                    setUserQuery(event.target.value);
                    setSubjectId("");
                    resetSubject();
                  }}
                  placeholder="Search name or email"
                  className="rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm outline-none focus:border-white/30"
                />
                <select
                  aria-label="Select user"
                  value={subjectId}
                  disabled={usersLoading}
                  onChange={(event) => {
                    setSubjectId(event.target.value);
                    resetSubject();
                  }}
                  className="cursor-pointer rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm disabled:cursor-wait disabled:opacity-50"
                >
                  <option value="">
                    {usersLoading ? "Loading users..." : "Select a user"}
                  </option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.displayName}
                      {user.email ? ` — ${user.email}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <input
                aria-label="Clerk organization ID"
                value={subjectId}
                onChange={(event) => {
                  setSubjectId(event.target.value);
                  resetSubject();
                }}
                placeholder="org_..."
                className="rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm outline-none focus:border-white/30"
              />
            )}

            <button
              type="submit"
              disabled={loading || !subjectId.trim()}
              className="cursor-pointer rounded-2xl bg-white px-5 py-3 text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? "Loading..."
                : subjectType === "user"
                  ? "Load user access"
                  : "Load organization access"}
            </button>
          </form>
          <p className="mt-3 text-sm leading-6 text-white/50">
            {displayName
              ? `Access controls are ready for ${displayName}.`
              : subjectType === "user"
                ? "Select a user, then load their current access before making changes."
                : "Enter a Clerk organization ID, then load its inherited access configuration."}
          </p>
        </section>

        <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          {displayName ? (
            <div className="flex flex-col gap-3 border-b border-white/10 pb-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-white/35">
                  Editing access for
                </p>
                <h2 className="mt-1 text-xl font-semibold">{displayName}</h2>
                <p className="mt-1 font-mono text-xs text-white/35">
                  {subjectId}
                </p>
              </div>
              <button
                type="button"
                onClick={save}
                disabled={loading}
                className="cursor-pointer rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading
                  ? "Saving..."
                  : subjectType === "user"
                    ? "Save user access"
                    : "Save organization access"}
              </button>
            </div>
          ) : (
            <div className="border-b border-white/10 pb-5">
              <p className="text-xs uppercase tracking-[0.16em] text-white/35">
                Access configuration
              </p>
              <h2 className="mt-1 text-xl font-semibold">
                Select a subject to begin
              </h2>
            </div>
          )}

          {subjectType === "user" ? (
            <div className="mt-6 border-b border-white/10 pb-6">
              <p className="text-xs uppercase tracking-[0.16em] text-cyan-300">
                1 · Therapeutic Areas
              </p>
              <h3 className="mt-1 text-lg font-semibold">
                Assign Therapeutic Areas by user
              </h3>
              <p className="mt-1 text-sm leading-6 text-white/45">
                Select every therapeutic area whose corpus and intelligence this user may access.
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {therapeuticAreaCatalog.length ? (
                  therapeuticAreaCatalog.map((area) => {
                    const checked = therapeuticAreas.includes(area);
                    return (
                      <label
                        key={area}
                        className={`flex items-center gap-3 rounded-2xl border p-4 transition ${
                          displayName
                            ? "cursor-pointer"
                            : "cursor-not-allowed opacity-50"
                        } ${
                          checked
                            ? "border-cyan-300/40 bg-cyan-300/10"
                            : "border-white/10 bg-black/30 hover:border-white/20"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={assignmentDisabled}
                          onChange={(event) =>
                            setTherapeuticAreas((current) =>
                              event.target.checked
                                ? [...current, area]
                                : current.filter(
                                    (currentArea) => currentArea !== area
                                  )
                            )
                          }
                          className="size-4 cursor-pointer accent-cyan-300 disabled:cursor-not-allowed"
                        />
                        <span className="text-sm font-medium">{area}</span>
                      </label>
                    );
                  })
                ) : (
                  <p className="text-sm text-white/45">
                    No active therapeutic areas are available.
                  </p>
                )}
              </div>
            </div>
          ) : null}

          <div className="mt-6 border-b border-white/10 pb-6">
            <p className="text-xs uppercase tracking-[0.16em] text-cyan-300">
              {subjectType === "user" ? "2" : "1"} · Modules
            </p>
            <h3 className="mt-1 text-lg font-semibold">
              Assign Modules by {subjectType}
            </h3>
            <p className="mt-1 text-sm leading-6 text-white/45">
              Enable, disable, or inherit each intelligence module. Effective status reflects the current access result.
            </p>
            <div className="mt-4 space-y-3">
              {modules.map((item) => (
                <CapabilityCard
                  key={item.key}
                  item={item}
                  state={states[item.key] || "inherit"}
                  effective={effectiveCapabilities[item.key]}
                  disabled={assignmentDisabled}
                  onChange={(state) =>
                    setStates((current) => ({
                      ...current,
                      [item.key]: state,
                    }))
                  }
                />
              ))}
            </div>
          </div>

          <div className="mt-6 border-b border-white/10 pb-6">
            <p className="text-xs uppercase tracking-[0.16em] text-cyan-300">
              {subjectType === "user" ? "3" : "2"} · Regulated workflow
            </p>
            <h3 className="mt-1 text-lg font-semibold">
              Enable PV Compliance by {subjectType}
            </h3>
            <p className="mt-1 text-sm leading-6 text-white/45">
              Controls visibility of PV Compliance and authorization for its screening, structured-review, QA, sponsor-handoff, transfer, audit, and reconciliation services.
            </p>
            {pvCapability ? (
              <div className="mt-4">
                <CapabilityCard
                  item={{
                    ...pvCapability,
                    label: "PV Compliance",
                    description:
                      "Governed pharmacovigilance operations with human review and sponsor escalation controls.",
                  }}
                  state={states[PV_ENTITLEMENT_KEY] || "inherit"}
                  effective={effectiveCapabilities[PV_ENTITLEMENT_KEY]}
                  disabled={assignmentDisabled}
                  onChange={(state) =>
                    setStates((current) => ({
                      ...current,
                      [PV_ENTITLEMENT_KEY]: state,
                    }))
                  }
                />
              </div>
            ) : (
              <p className="mt-4 text-sm text-white/45">
                PV Compliance entitlement is unavailable.
              </p>
            )}
          </div>

          <details className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5">
            <summary className="cursor-pointer text-sm font-semibold text-white/75">
              Advanced capability access
            </summary>
            <p className="mt-2 text-sm leading-6 text-white/45">
              Configure platform, intelligence, agent, data-package, export, and governance capabilities not covered above.
            </p>
            <div className="mt-4 space-y-3">
              {advancedCapabilities.length ? (
                advancedCapabilities.map((item) => (
                  <CapabilityCard
                    key={item.key}
                    item={item}
                    state={states[item.key] || "inherit"}
                    effective={effectiveCapabilities[item.key]}
                    disabled={assignmentDisabled}
                    onChange={(state) =>
                      setStates((current) => ({
                        ...current,
                        [item.key]: state,
                      }))
                    }
                  />
                ))
              ) : (
                <p className="text-sm text-white/45">
                  Loading available entitlements...
                </p>
              )}
            </div>
          </details>
        </section>

        {message ? (
          <div
            role="status"
            className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/70"
          >
            {message}
          </div>
        ) : null}
      </div>
    </main>
  );
}

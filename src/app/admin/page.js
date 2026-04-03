"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useMemo, useState } from "react";

export default function AdminPage() {
  const { userId, isLoaded } = useAuth();

  const [lookupUserId, setLookupUserId] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [newArea, setNewArea] = useState("");
  const [allAreas, setAllAreas] = useState([]);
  const [message, setMessage] = useState("");

  async function parseResponse(res) {
    const raw = await res.text();

    try {
      return raw ? JSON.parse(raw) : {};
    } catch {
      throw new Error(
        `Non-JSON response (${res.status} ${res.statusText}): ${raw.slice(0, 300)}`
      );
    }
  }

  useEffect(() => {
    if (!isLoaded || !userId) return;

    async function loadAreas() {
      try {
        const res = await fetch("/api/admin/therapeutic-areas");
        const data = await parseResponse(res);

        if (!res.ok) {
          throw new Error(data?.error || "Failed to load therapeutic areas");
        }

        setAllAreas(Array.isArray(data?.areas) ? data.areas : []);
      } catch (err) {
        console.error("Failed to load therapeutic areas:", err);
      }
    }

    loadAreas();
  }, [isLoaded, userId]);

  const availableAreas = useMemo(() => {
    const assigned = new Set(result?.therapeutic_areas || []);
    return allAreas.filter((area) => !assigned.has(area));
  }, [allAreas, result]);

  useEffect(() => {
    if (!newArea) return;

    if (!availableAreas.includes(newArea)) {
      setNewArea("");
    }
  }, [availableAreas, newArea]);

  async function loadUserAccess() {
    setLoading(true);
    setMessage("");
    setResult(null);

    try {
      const res = await fetch("/api/admin/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clerk_user_id: lookupUserId.trim() }),
      });

      const data = await parseResponse(res);

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load access");
      }

      setResult(data);
    } catch (err) {
      setMessage(err.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function addAccess() {
    if (!lookupUserId || !newArea) return;

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/admin/access/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clerk_user_id: lookupUserId.trim(),
          therapeutic_area: newArea,
        }),
      });

      const data = await parseResponse(res);

      if (!res.ok) {
        throw new Error(data?.error || "Failed to add access");
      }

      setMessage("Access added.");
      setNewArea("");
      await loadUserAccess();
    } catch (err) {
      setMessage(err.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function removeAccess(area) {
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/admin/access/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clerk_user_id: lookupUserId.trim(),
          therapeutic_area: area,
        }),
      });

      const data = await parseResponse(res);

      if (!res.ok) {
        throw new Error(data?.error || "Failed to remove access");
      }

      setMessage("Access removed.");
      await loadUserAccess();
    } catch (err) {
      setMessage(err.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  if (!isLoaded) {
    return (
      <main className="min-h-screen bg-black text-white px-6 py-10">
        <div className="mx-auto max-w-4xl">Loading...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-3xl font-semibold">Admin Access Manager</h1>
        <p className="mt-2 text-white/60">
          Search a Clerk user and manage their therapeutic area access.
        </p>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
          <label className="block text-sm text-white/70 mb-2">
            Clerk User ID
          </label>
          <div className="flex gap-3">
            <input
              value={lookupUserId}
              onChange={(e) => setLookupUserId(e.target.value)}
              placeholder="user_..."
              className="flex-1 rounded-xl bg-black/40 border border-white/10 px-4 py-3 outline-none"
            />
            <button
              onClick={loadUserAccess}
              disabled={loading || !lookupUserId.trim()}
              className="rounded-xl bg-white text-black px-5 py-3 font-medium disabled:opacity-50"
            >
              {loading ? "Loading..." : "Search"}
            </button>
          </div>
        </div>

        {message ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
            {message}
          </div>
        ) : null}

        {result ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="text-sm text-white/60">User</div>
            <div className="mt-1 text-lg font-medium">{result.clerk_user_id}</div>

            <div className="mt-6">
              <div className="text-sm text-white/60 mb-3">
                Current Therapeutic Areas
              </div>

              {result.therapeutic_areas.length === 0 ? (
                <div className="text-white/50">No access assigned.</div>
              ) : (
                <div className="space-y-2">
                  {result.therapeutic_areas.map((area) => (
                    <div
                      key={area}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-4 py-3"
                    >
                      <div>{area}</div>
                      <button
                        onClick={() => removeAccess(area)}
                        className="rounded-lg border border-red-400/30 px-3 py-1 text-sm text-red-300 hover:bg-red-500/10"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-8">
              <div className="text-sm text-white/60 mb-3">
                Add Therapeutic Area
              </div>
              <div className="flex gap-3">
                <select
                  value={newArea}
                  onChange={(e) => setNewArea(e.target.value)}
                  className="flex-1 rounded-xl bg-black/40 border border-white/10 px-4 py-3 outline-none"
                >
                  <option value="">
                    {availableAreas.length
                      ? "Select therapeutic area"
                      : "No remaining areas available"}
                  </option>
                  {availableAreas.map((area) => (
                    <option key={area} value={area}>
                      {area}
                    </option>
                  ))}
                </select>

                <button
                  onClick={addAccess}
                  disabled={loading || !newArea}
                  className="rounded-xl bg-white text-black px-5 py-3 font-medium disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function titleCaseFromSlug(value: string) {
  return value
    .replace(/\.[^/.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function normalizeArea(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

async function getFixtureTherapeuticAreas() {
  const fixturesDir = path.join(process.cwd(), "fixtures", "curated");

  try {
    const files = await fs.readdir(fixturesDir);
    const areas = new Set<string>();

    for (const file of files) {
      const lower = file.toLowerCase();

      if (
        !lower.endsWith(".csv") &&
        !lower.endsWith(".pdf") &&
        !lower.endsWith(".json")
      ) {
        continue;
      }

      let base = file;

      base = base.replace(/\.[^/.]+$/, "");
      base = base.replace(/_insights_sample$/i, "");
      base = base.replace(/_patient-insights_by-country_v\d+$/i, "");
      base = base.replace(/_patient insights_by-country_v\d+$/i, "");
      base = base.replace(/_meta$/i, "");

      const area = normalizeArea(titleCaseFromSlug(base));
      if (area) areas.add(area);
    }

    return Array.from(areas);
  } catch {
    return [];
  }
}

async function getSupabaseTherapeuticAreas() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return [];
  }

  try {
    const supabase = createClient(url, key);

    const { data, error } = await supabase
      .from("curated_insights")
      .select("therapeutic_area")
      .not("therapeutic_area", "is", null)
      .limit(1000);

    if (error) {
      console.error("[therapeutic-areas] supabase error", error);
      return [];
    }

    const areas = Array.from(
      new Set(
        (data || [])
          .map((row) => normalizeArea(row.therapeutic_area || ""))
          .filter(Boolean)
      )
    );

    return areas;
  } catch (error) {
    console.error("[therapeutic-areas] unexpected supabase error", error);
    return [];
  }
}

export async function GET() {
  try {
    const [supabaseAreas, fixtureAreas] = await Promise.all([
      getSupabaseTherapeuticAreas(),
      getFixtureTherapeuticAreas(),
    ]);

    const therapeuticAreas = Array.from(
      new Set([...supabaseAreas, ...fixtureAreas].filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));

    return NextResponse.json({
      ok: true,
      therapeuticAreas,
      debug: {
        supabaseAreasCount: supabaseAreas.length,
        fixtureAreasCount: fixtureAreas.length,
      },
    });
  } catch (error: any) {
    console.error("[/api/therapeutic-areas] error", error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to load therapeutic areas",
        therapeuticAreas: [],
      },
      { status: 500 }
    );
  }
}
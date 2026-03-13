import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function GET() {
  return Response.json({
    ok: true,
    message:
      "Use POST /api/ask with { question, therapeutic_area?, layer?, block_type?, match_count? }",
  });
}

export async function POST(req) {
  try {
    const body = await req.json();

    const {
      question,
      therapeutic_area = null,
      layer = null,
      block_type = null,
      match_count = 6,
    } = body || {};

    if (!question || !question.trim()) {
      return Response.json({ error: "Missing question" }, { status: 400 });
    }

    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: question.trim(),
    });

    const query_embedding = embeddingResponse?.data?.[0]?.embedding;

    if (!Array.isArray(query_embedding)) {
      return Response.json(
        { error: "Failed to generate embedding." },
        { status: 500 }
      );
    }

    const { data: matches, error: matchErr } = await supabase.rpc(
      "match_documents",
      {
        query_embedding,
        match_count,
        ta_filter: therapeutic_area,
        layer_filter: layer,
        block_type_filter: block_type,
      }
    );

    if (matchErr) {
      return Response.json({ error: matchErr.message }, { status: 500 });
    }

    const sources = (matches || []).map((m) => ({
      id: m.id,
      title: m.title,
      quarter: m.quarter,
      layer: m.layer,
      block_type: m.block_type,
      source: m.source,
      content: m.content,
      similarity: m.similarity,
    }));

    if (!sources.length) {
      return Response.json(
        {
          answer:
            "No relevant sources were found for that question in the selected repository and layer.",
          sources: [],
        },
        { status: 200 }
      );
    }

    const context = sources
      .map(
        (m, i) =>
          `SOURCE ${i + 1}
Title: ${m.title}
Quarter: ${m.quarter || "N/A"}
Layer: ${m.layer || "N/A"}
Block Type: ${m.block_type || "N/A"}
Similarity: ${
            typeof m.similarity === "number" ? m.similarity.toFixed(3) : "N/A"
          }
Content: ${m.content}`
      )
      .join("\n\n");

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 700,
      temperature: 0.2,
      system:
        "You are a pharma social intelligence analyst. " +
        "Use ONLY the provided SOURCES. " +
        "If the answer is not supported by the sources, say 'Not found in sources.' " +
        "Do NOT provide medical advice. " +
        "Be concise, clear, and useful for a biotech/pharma audience.",
      messages: [
        {
          role: "user",
          content:
            `QUESTION: ${question}\n\n` +
            `SOURCES:\n${context}\n\n` +
            `Return your answer in this format:\n` +
            `1. A concise answer paragraph\n` +
            `2. Three bullet takeaways\n` +
            `3. A short line naming the most important source themes`,
        },
      ],
    });

    const answer =
      response?.content
        ?.filter((item) => item.type === "text")
        ?.map((item) => item.text)
        ?.join("\n\n") || "Not found in sources.";

    return Response.json(
      {
        answer,
        sources,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("❌ /api/ask error:", err);

    return Response.json(
      {
        error: err?.message || "Unknown server error",
        name: err?.name || null,
        cause: err?.cause ? String(err.cause) : null,
      },
      { status: 500 }
    );
  }
}
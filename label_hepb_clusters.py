import os
import pandas as pd
from openai import OpenAI

INPUT_CSV = "hepb_clustered_output.csv"
OUTPUT_CSV = "hepb_cluster_themes.csv"
MODEL = "gpt-5.4"
SAMPLE_SIZE = 15


def main():
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError(
            'OPENAI_API_KEY is not set.\n'
            'Run:\n'
            'export OPENAI_API_KEY="your-new-key-here"'
        )

    if not os.path.exists(INPUT_CSV):
        raise FileNotFoundError(f"Could not find '{INPUT_CSV}' in this folder.")

    client = OpenAI()

    df = pd.read_csv(INPUT_CSV)

    if "cluster" not in df.columns or "raw_text" not in df.columns:
        raise ValueError("Expected columns 'cluster' and 'raw_text' in hepb_clustered_output.csv")

    clustered = df[df["cluster"] != -1].copy()

    if clustered.empty:
        raise ValueError("No non-noise clusters found.")

    results = []

    for cluster_id in sorted(clustered["cluster"].unique()):
        cluster_df = clustered[clustered["cluster"] == cluster_id].copy()
        sample_posts = (
            cluster_df["raw_text"]
            .dropna()
            .astype(str)
            .head(SAMPLE_SIZE)
            .tolist()
        )

        prompt = f"""
You are analyzing social media and news-style mentions about Hepatitis B.

Below are posts from one semantic cluster.
Identify the main theme.

Return exactly in this format:

Theme: <short label, max 8 words>
Explanation: <one sentence explanation>

Posts:
""" + "\n".join([f"- {p[:500]}" for p in sample_posts])

        response = client.responses.create(
            model=MODEL,
            input=prompt
        )

        text = response.output_text.strip()

        theme = ""
        explanation = ""

        for line in text.splitlines():
            if line.lower().startswith("theme:"):
                theme = line.split(":", 1)[1].strip()
            elif line.lower().startswith("explanation:"):
                explanation = line.split(":", 1)[1].strip()

        if not theme:
            theme = "Unlabeled cluster"
        if not explanation:
            explanation = text

        results.append({
            "cluster": int(cluster_id),
            "theme": theme,
            "explanation": explanation,
            "cluster_size": len(cluster_df)
        })

        print(f"Cluster {cluster_id}: {theme}")

    out = pd.DataFrame(results).sort_values("cluster_size", ascending=False)
    out.to_csv(OUTPUT_CSV, index=False)

    print(f"Saved: {OUTPUT_CSV}")


if __name__ == "__main__":
    main()
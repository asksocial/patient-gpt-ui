import os
import re
import time
from collections import Counter

import numpy as np
import pandas as pd
import hdbscan
from openai import OpenAI

# =========================
# CONFIG
# =========================
CSV_PATH = "hepb.csv"
MAX_ROWS = 500

EMBEDDING_MODEL = "text-embedding-3-small"

# More permissive clustering settings
MIN_CLUSTER_SIZE = 8
MIN_SAMPLES = 2

OUTPUT_CSV = "hepb_clustered_output.csv"

TEXT_COLUMNS_TO_COMBINE = [
    "Headline",
    "Opening Text",
    "Hit Sentence",
]

OPTIONAL_OUTPUT_COLUMNS = [
    "Date",
    "Time",
    "Source",
    "Country",
    "Language",
    "Engagement",
    "Sentiment",
    "URL",
]


# =========================
# HELPERS
# =========================
def clean_text(text):
    if pd.isna(text):
        return ""

    text = str(text)
    text = re.sub(r"http\S+|www\.\S+", " ", text)
    text = re.sub(r"@\w+", " ", text)
    text = re.sub(r"#", "", text)
    text = re.sub(r"\bRT\b", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def load_csv(csv_path):
    """
    First try the expected Meltwater-style format:
    UTF-16 + tab-delimited.
    Fall back to a more forgiving parser if needed.
    """
    try:
        df = pd.read_csv(
            csv_path,
            encoding="utf-16",
            sep="\t",
            engine="python",
        )
        print("Loaded CSV using utf-16 + tab separator.")
        return df
    except Exception as first_error:
        print("First CSV read attempt failed:")
        print(first_error)
        print("Trying fallback parser...")

        df = pd.read_csv(
            csv_path,
            encoding="latin-1",
            engine="python",
            on_bad_lines="skip",
        )
        print("Loaded CSV using latin-1 fallback.")
        return df


def build_text_column(df):
    print("Building combined text field from Headline + Opening Text + Hit Sentence...")

    available_parts = []
    for col in TEXT_COLUMNS_TO_COMBINE:
        if col in df.columns:
            available_parts.append(df[col].fillna("").astype(str))

    if not available_parts:
        raise ValueError(
            f"Could not find usable text columns. Available columns: {list(df.columns)}"
        )

    combined = available_parts[0]
    for series in available_parts[1:]:
        combined = combined + " " + series

    return combined


def batch_embed_texts(client, texts, batch_size=100):
    """
    Embed text in batches.
    """
    all_embeddings = []

    for start in range(0, len(texts), batch_size):
        batch = texts[start:start + batch_size]
        print(f"Embedding batch {start + 1}-{start + len(batch)} of {len(texts)}...")

        response = client.embeddings.create(
            model=EMBEDDING_MODEL,
            input=batch,
        )
        all_embeddings.extend([item.embedding for item in response.data])

        time.sleep(0.25)

    return all_embeddings


# =========================
# MAIN
# =========================
def main():
    print("Starting script...")

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError(
            'OPENAI_API_KEY is not set.\n'
            'Run:\n'
            'export OPENAI_API_KEY="your-new-key-here"'
        )

    if not os.path.exists(CSV_PATH):
        raise FileNotFoundError(f"Could not find '{CSV_PATH}' in this folder.")

    client = OpenAI()

    df = load_csv(CSV_PATH)
    print("CSV loaded.")
    print("Columns:", list(df.columns))
    print("Rows:", len(df))

    # Build richer text representation
    df = df.copy()
    df["raw_text"] = build_text_column(df)
    df["clean_text"] = df["raw_text"].apply(clean_text)

    # Remove empty rows and exact duplicate text
    df = df[df["clean_text"].str.len() > 0].copy()
    df = df.drop_duplicates(subset=["clean_text"]).copy()

    # Keep first MAX_ROWS for easier testing
    df = df.head(MAX_ROWS).copy()

    print("Rows after cleaning/deduping/limit:", len(df))

    if len(df) < 20:
        raise ValueError("Too few usable rows after cleaning. Check your CSV and text fields.")

    texts = df["clean_text"].tolist()
    embeddings = batch_embed_texts(client, texts, batch_size=100)

    print("Clustering...")
    embedding_matrix = np.array(embeddings)

    clusterer = hdbscan.HDBSCAN(
        min_cluster_size=MIN_CLUSTER_SIZE,
        min_samples=MIN_SAMPLES,
        metric="euclidean",
        cluster_selection_method="leaf",
        allow_single_cluster=True,
    )

    df["cluster"] = clusterer.fit_predict(embedding_matrix)

    print("Cluster counts:")
    print(dict(Counter(df["cluster"])))

    output_columns = ["raw_text", "clean_text", "cluster"]
    for col in OPTIONAL_OUTPUT_COLUMNS:
        if col in df.columns and col not in output_columns:
            output_columns.insert(0, col)

    df[output_columns].to_csv(OUTPUT_CSV, index=False)
    print(f"Saved: {OUTPUT_CSV}")


if __name__ == "__main__":
    main()
import pandas as pd

CLUSTERED_CSV = "hepb_clustered_output.csv"
THEMES_CSV = "hepb_cluster_themes.csv"
OUTPUT_CSV = "hepb_clustered_with_themes.csv"
SUMMARY_CSV = "hepb_theme_summary.csv"

def main():
    clustered = pd.read_csv(CLUSTERED_CSV)
    themes = pd.read_csv(THEMES_CSV)

    merged = clustered.merge(themes, on="cluster", how="left")

    # Fill noise rows with a readable label
    merged["theme"] = merged["theme"].fillna("Noise / Unclustered")
    merged["explanation"] = merged["explanation"].fillna("No cluster theme assigned.")
    merged["cluster_size"] = merged["cluster_size"].fillna(0)

    merged.to_csv(OUTPUT_CSV, index=False)

    summary = (
        merged.groupby(["cluster", "theme", "explanation"], dropna=False)
        .size()
        .reset_index(name="mention_count")
        .sort_values("mention_count", ascending=False)
    )
    summary.to_csv(SUMMARY_CSV, index=False)

    print(f"Saved: {OUTPUT_CSV}")
    print(f"Saved: {SUMMARY_CSV}")
    print("\nTop themes:")
    print(summary.head(10).to_string(index=False))

if __name__ == "__main__":
    main()
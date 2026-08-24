const therapeuticAreaCollator = new Intl.Collator("en", {
  sensitivity: "base",
  numeric: true,
});

export function sortTherapeuticAreas(
  therapeuticAreas: string[]
): string[] {
  return [...therapeuticAreas].sort((left, right) =>
    therapeuticAreaCollator.compare(left, right)
  );
}

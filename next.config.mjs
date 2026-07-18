/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  outputFileTracingIncludes: {
    "/api/ask": [
      "./data/*.csv",
      "./src/ingestion/curated/gene_therapy.json",
    ],
  },
};

export default nextConfig;

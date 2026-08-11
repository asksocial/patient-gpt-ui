/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  outputFileTracingIncludes: {
    "/api/ask": [
      "./data/*.csv",
      "./src/ingestion/curated/gene_therapy.json",
    ],
    "/api/module-intelligence": ["./data/*.csv"],
    "/api/patient-intelligence": ["./data/*.csv"],
    "/api/monitoring/run": ["./data/*.csv"],
    "/api/cron/monitoring": ["./data/*.csv"],
  },
};

export default nextConfig;

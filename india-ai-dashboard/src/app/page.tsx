import { JsonLd } from "@/components/JsonLd";
import { siteConfig } from "@/lib/seo";
import { getDashboardDataset } from "@/services/dashboardData";
import { IndiaAiDashboard } from "../dashboard-ui/IndiaAiDashboard";

export const revalidate = 86400;

export default function Page() {
  const dataset = getDashboardDataset();
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Dataset",
          name: dataset.metadata.title,
          description: siteConfig.description,
          url: siteConfig.url,
          creator: "India AI Development & Investment Intelligence Platform",
          temporalCoverage: `${Math.min(...dataset.records.map((record) => record.year))}/${Math.max(...dataset.records.map((record) => record.year))}`,
          keywords: ["India AI", "AI policy", "AI investments", "state dashboard"],
        }}
      />
      <IndiaAiDashboard initialDataset={dataset} />
    </>
  );
}

import { notFound } from "next/navigation";

import { EntityDetailPage } from "@/features/entity-pages/EntityDetailPage";
import { createPageMetadata } from "@/lib/seo";
import { findEntity, getInvestmentPeriods } from "@/services/dashboardData";

export const dynamicParams = false;
export const revalidate = 86400;

export function generateStaticParams() {
  return getInvestmentPeriods().map((entity) => ({ period: entity.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ period: string }> }) {
  const { period } = await params;
  const entity = findEntity("investment-period", period);
  if (!entity) return {};
  return createPageMetadata({
    title: `${entity.title} AI Investment Announcements`,
    description: entity.description,
    path: `/investments/${entity.slug}`,
  });
}

export default async function InvestmentPeriodPage({ params }: { params: Promise<{ period: string }> }) {
  const { period } = await params;
  const entity = findEntity("investment-period", period);
  if (!entity) notFound();
  return <EntityDetailPage entity={entity} />;
}

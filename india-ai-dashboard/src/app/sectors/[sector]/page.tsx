import { notFound } from "next/navigation";

import { EntityDetailPage } from "@/features/entity-pages/EntityDetailPage";
import { createPageMetadata } from "@/lib/seo";
import { findEntity, getSectors } from "@/services/dashboardData";

export const dynamicParams = false;
export const revalidate = 86400;

export function generateStaticParams() {
  return getSectors().map((entity) => ({ sector: entity.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ sector: string }> }) {
  const { sector } = await params;
  const entity = findEntity("sector", sector);
  if (!entity) return {};
  return createPageMetadata({
    title: `${entity.title} AI Sector Intelligence`,
    description: entity.description,
    path: `/sectors/${entity.slug}`,
  });
}

export default async function SectorPage({ params }: { params: Promise<{ sector: string }> }) {
  const { sector } = await params;
  const entity = findEntity("sector", sector);
  if (!entity) notFound();
  return <EntityDetailPage entity={entity} />;
}

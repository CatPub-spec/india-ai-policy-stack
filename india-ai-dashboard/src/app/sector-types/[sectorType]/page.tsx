import { notFound } from "next/navigation";

import { EntityDetailPage } from "@/features/entity-pages/EntityDetailPage";
import { createPageMetadata } from "@/lib/seo";
import { findEntity, getSectorTypes } from "@/services/dashboardData";

export const dynamicParams = false;
export const revalidate = 86400;

export function generateStaticParams() {
  return getSectorTypes().map((entity) => ({ sectorType: entity.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ sectorType: string }> }) {
  const { sectorType } = await params;
  const entity = findEntity("sector-type", sectorType);
  if (!entity) return {};
  const title = entity.title.replace(/\s*Domain$/i, "");
  return createPageMetadata({
    title: `${title} AI Sector Type Intelligence`,
    description: entity.description,
    path: `/sector-types/${entity.slug}`,
  });
}

export default async function SectorTypePage({ params }: { params: Promise<{ sectorType: string }> }) {
  const { sectorType } = await params;
  const entity = findEntity("sector-type", sectorType);
  if (!entity) notFound();
  return <EntityDetailPage entity={entity} />;
}

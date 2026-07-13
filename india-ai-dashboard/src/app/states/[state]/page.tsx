import { notFound } from "next/navigation";

import { EntityDetailPage } from "@/features/entity-pages/EntityDetailPage";
import { createPageMetadata } from "@/lib/seo";
import { findEntity, getStates } from "@/services/dashboardData";

export const dynamicParams = false;
export const revalidate = 86400;

export function generateStaticParams() {
  return getStates().map((entity) => ({ state: entity.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ state: string }> }) {
  const { state } = await params;
  const entity = findEntity("state", state);
  if (!entity) return {};
  return createPageMetadata({
    title: `${entity.title} AI Development Dashboard`,
    description: entity.description,
    path: `/states/${entity.slug}`,
  });
}

export default async function StatePage({ params }: { params: Promise<{ state: string }> }) {
  const { state } = await params;
  const entity = findEntity("state", state);
  if (!entity) notFound();
  return <EntityDetailPage entity={entity} />;
}

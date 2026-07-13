import { notFound } from "next/navigation";

import { EntityDetailPage } from "@/features/entity-pages/EntityDetailPage";
import { createPageMetadata } from "@/lib/seo";
import { findEntity, getPolicies } from "@/services/dashboardData";

export const dynamicParams = false;
export const revalidate = 86400;

export function generateStaticParams() {
  return getPolicies().map((entity) => ({ policy: entity.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ policy: string }> }) {
  const { policy } = await params;
  const entity = findEntity("policy", policy);
  if (!entity) return {};
  return createPageMetadata({
    title: `${entity.title} | AI Policy Intelligence`,
    description: entity.description,
    path: `/policies/${entity.slug}`,
  });
}

export default async function PolicyPage({ params }: { params: Promise<{ policy: string }> }) {
  const { policy } = await params;
  const entity = findEntity("policy", policy);
  if (!entity) notFound();
  return <EntityDetailPage entity={entity} />;
}

import { notFound } from "next/navigation";

import { EntityDetailPage } from "@/features/entity-pages/EntityDetailPage";
import { createPageMetadata } from "@/lib/seo";
import { findEntity, getCompanies } from "@/services/dashboardData";

export const dynamicParams = false;
export const revalidate = 86400;

export function generateStaticParams() {
  return getCompanies().map((entity) => ({ company: entity.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ company: string }> }) {
  const { company } = await params;
  const entity = findEntity("company", company);
  if (!entity) return {};
  return createPageMetadata({
    title: `${entity.title} AI Development Announcements`,
    description: entity.description,
    path: `/companies/${entity.slug}`,
  });
}

export default async function CompanyPage({ params }: { params: Promise<{ company: string }> }) {
  const { company } = await params;
  const entity = findEntity("company", company);
  if (!entity) notFound();
  return <EntityDetailPage entity={entity} />;
}

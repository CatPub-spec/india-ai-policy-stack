import type { Metadata } from "next";

export const siteConfig = {
  name: "India AI Development & Investment Intelligence Platform",
  shortName: "India AI Policy Stack",
  description:
    "Searchable intelligence dashboard for verified India AI development, policy, company, sector, and investment announcements.",
  url: process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:3000",
  ogImagePath: "/indiaAI.jpeg",
};

export function absoluteUrl(path = "/"): string {
  return new URL(path, siteConfig.url).toString();
}

export function createPageMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  const url = absoluteUrl(path);
  const image = absoluteUrl(siteConfig.ogImagePath);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: siteConfig.name,
      type: "website",
      images: [{ url: image, width: 1200, height: 630, alt: siteConfig.shortName }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

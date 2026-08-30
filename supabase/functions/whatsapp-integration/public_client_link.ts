export interface PublicClientLinkInput {
  appUrl: string;
  tenantSlug?: string | null;
  legacyToken?: string | null;
  legacyPath?: string;
}

const cleanSegment = (value: string | null | undefined): string => value?.trim().replace(/^\/+|\/+$/g, '') || '';

export const buildPublicClientLink = ({
  appUrl,
  tenantSlug,
  legacyToken,
  legacyPath,
}: PublicClientLinkInput): string => {
  const baseUrl = appUrl.trim().replace(/\/+$/, '');
  const slug = cleanSegment(tenantSlug);

  if (slug) {
    return `${baseUrl}/${encodeURIComponent(slug)}`;
  }

  const token = cleanSegment(legacyToken);
  if (!token) return baseUrl;

  const suffix = cleanSegment(legacyPath);
  return `${baseUrl}/cliente/${encodeURIComponent(token)}${suffix ? `/${encodeURIComponent(suffix)}` : ''}`;
};

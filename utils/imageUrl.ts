export function getCatalogImageUrl(url: string | null, width = 640) {
  if (!url) return null;

  const publicObjectPath = '/storage/v1/object/public/';
  if (!url.includes(publicObjectPath)) return url;

  const transformed = url.replace(
    publicObjectPath,
    '/storage/v1/render/image/public/'
  );
  const separator = transformed.includes('?') ? '&' : '?';

  return `${transformed}${separator}width=${width}&quality=72&resize=contain`;
}

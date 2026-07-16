export function getCatalogImageUrl(url: string | null, _width = 640) {
  // The Free plan does not include Storage image transformations. Catalog
  // originals are optimized before upload, so requesting the public object
  // directly avoids a failed transform request followed by a second download.
  return url;
}

export function getOrderedCatalogIds(value: unknown): string[] {
  let parsed = value;

  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed) as unknown;
    } catch {
      return [];
    }
  }

  const orderedIds = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as { orderedIds?: unknown }).orderedIds)
      ? (parsed as { orderedIds: unknown[] }).orderedIds
      : [];

  const seen = new Set<string>();
  return orderedIds.filter((id): id is string => {
    if (typeof id !== 'string' || id.length === 0 || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

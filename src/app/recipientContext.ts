/** Provenance markers belong in data details, not relationship labels. */
export function visibleRelationship(value?: string | null): string | null {
  if (!value || /fictional synthetic|synthetic.*fixture/i.test(value)) return null;
  return value;
}

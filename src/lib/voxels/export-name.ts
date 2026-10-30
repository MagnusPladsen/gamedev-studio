/** Turns a model name into a safe file and material name: lowercase, dashes between words, "model" when empty. */
export function exportFileBase(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "model";
}

export function officeHandle(id: string): string {
  const slug = id.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `office-${slug}`.slice(0, 48)
}

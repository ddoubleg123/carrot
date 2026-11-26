/** A public username taken from the desk's name, so the handle says the subject. */
export function deskSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

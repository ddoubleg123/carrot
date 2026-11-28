/** An image copied with Ctrl+C, including a screenshot. Text on the clipboard is left alone. */
export function imageFromClipboard(data: DataTransfer | null): File | null {
  if (!data) return null
  const items = data.items
  if (items) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.kind !== 'file' || !item.type.startsWith('image/')) continue
      const file = item.getAsFile()
      if (!file) continue
      const type = file.type || item.type || 'image/png'
      const name = file.name && file.name !== 'image.png' ? file.name : `paste.${type.split('/')[1] || 'png'}`
      return new File([file], name, { type })
    }
  }
  for (const file of Array.from(data.files || [])) {
    if (file.type.startsWith('image/')) return file
  }
  return null
}

/**
 * Compression des photos avant envoi : une photo de téléphone fait 3 à 15 Mo, inutile pour un
 * suivi de chantier et refusée par le serveur au-delà de la limite. On la redimensionne
 * (plus grand côté ≤ `maxSide`) et on l'encode en JPEG. L'orientation EXIF est respectée par
 * `createImageBitmap`. En cas d'échec (format non décodable, navigateur ancien), le fichier
 * d'origine est renvoyé tel quel : le serveur tranche.
 */
const MAX_SIDE = 2048
const QUALITY = 0.82
/** En dessous de cette taille, une image JPEG / WebP est envoyée telle quelle. */
const SKIP_BELOW = 600 * 1024

export async function compressImage(file: File, maxSide = MAX_SIDE, quality = QUALITY): Promise<File> {
  if (file.size < SKIP_BELOW && /^image\/(jpeg|webp)$/.test(file.type)) return file
  if (typeof createImageBitmap !== 'function') return file

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    if (!blob || blob.size >= file.size) return file

    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
    return new File([blob], name, { type: 'image/jpeg', lastModified: file.lastModified })
  } catch {
    return file
  }
}

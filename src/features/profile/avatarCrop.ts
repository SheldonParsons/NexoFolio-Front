export interface AvatarCrop {
  image: HTMLImageElement
  url: string
  width: number
  height: number
}
export interface CropPosition {
  zoom: number
  x: number
  y: number
}
type Dimensions = Pick<AvatarCrop, 'width' | 'height'>
const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value))
export function cropRectangle(crop: Dimensions, position: CropPosition) {
  const side = Math.min(crop.width, crop.height) / clamp(position.zoom, 1, 4)
  return {
    side,
    left: (crop.width - side) * clamp(position.x),
    top: (crop.height - side) * clamp(position.y),
  }
}
/** Pointer movement and keyboard movement share the same source-image bounds. */
export function panCrop(
  crop: Dimensions,
  position: CropPosition,
  dx: number,
  dy: number,
  viewport: number,
): CropPosition {
  if (viewport <= 0) return position
  const { side } = cropRectangle(crop, position)
  return {
    ...position,
    x: crop.width > side ? clamp(position.x - (dx * side) / viewport / (crop.width - side)) : 0.5,
    y: crop.height > side ? clamp(position.y - (dy * side) / viewport / (crop.height - side)) : 0.5,
  }
}
/** Keep the chosen subject centered while changing magnification. */
export function zoomCrop(crop: Dimensions, position: CropPosition, zoom: number): CropPosition {
  const previous = cropRectangle(crop, position)
  const boundedZoom = clamp(zoom, 1, 4)
  const side = Math.min(crop.width, crop.height) / boundedZoom
  return {
    zoom: boundedZoom,
    x:
      crop.width > side
        ? clamp((previous.left + (previous.side - side) / 2) / (crop.width - side))
        : 0.5,
    y:
      crop.height > side
        ? clamp((previous.top + (previous.side - side) / 2) / (crop.height - side))
        : 0.5,
  }
}
export async function openAvatar(file: File): Promise<AvatarCrop> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new Error('请选择 JPG、PNG 或 WebP 图片')
  if (file.size > 20 * 1024 * 1024) throw new Error('原图需小于 20 MiB')
  const url = URL.createObjectURL(file),
    image = new Image()
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('这张图片无法读取，请换一张'))
      image.src = url
    })
    if (
      !image.naturalWidth ||
      !image.naturalHeight ||
      image.naturalWidth > 20000 ||
      image.naturalHeight > 20000
    )
      throw new Error('图片尺寸过大或无效')
    return { image, url, width: image.naturalWidth, height: image.naturalHeight }
  } catch (cause) {
    URL.revokeObjectURL(url)
    throw cause
  }
}
export function drawCrop(canvas: HTMLCanvasElement, crop: AvatarCrop, position: CropPosition) {
  if (canvas.width !== 512 || canvas.height !== 512) canvas.width = canvas.height = 512
  const { side, left, top } = cropRectangle(crop, position)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('暂时无法生成头像预览')
  context.clearRect(0, 0, 512, 512)
  context.drawImage(crop.image, left, top, side, side, 0, 0, 512, 512)
}
export async function cropDataURL(canvas: HTMLCanvasElement): Promise<string> {
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error('暂时无法生成头像'))),
      'image/webp',
      0.88,
    ),
  )
  if (blob.type !== 'image/webp' || blob.size > 256 * 1024)
    throw new Error('头像生成失败或尺寸过大，请选择更简单的图片')
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('暂时无法读取头像'))
    reader.readAsDataURL(blob)
  })
}

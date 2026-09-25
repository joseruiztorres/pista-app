// Extensión de archivo segura para subir media a Storage.
//
// Bug que arregla: en la versión web, expo-image-picker puede devolver
// `asset.uri` como un data URI (`data:image/jpeg;base64,/9j/4AAQ...`) en vez
// de una ruta de archivo normal. Como el contenido en base64 de una foto o
// vídeo real casi siempre contiene algún punto, `uri.split('.').pop()`
// terminaba metiendo un trozo entero del archivo en el nombre que se subía
// a Storage, generando rutas enormes o inválidas (afecta a fotos, vídeos,
// historias y avatar).
//
// Con esto: la extensión sale primero del `mimeType` que ya trae el asset
// (fiable en cualquier plataforma); solo si no hay mimeType se intenta leer
// la URI, y únicamente cuando de verdad parece una ruta de archivo (no un
// data URI) y el resultado es corto y alfanumérico.
export function extFromAsset(asset, fallback) {
  const fromMime = asset?.mimeType && asset.mimeType.split('/')[1];
  if (fromMime) {
    const clean = fromMime.split('+')[0].split(';')[0];
    if (clean && clean.length <= 5) return clean;
  }
  const uri = asset?.uri || '';
  if (uri && !uri.startsWith('data:')) {
    const candidate = uri.split('.').pop().split('?')[0];
    if (candidate && candidate.length <= 5 && /^[a-zA-Z0-9]+$/.test(candidate)) {
      return candidate;
    }
  }
  return fallback;
}

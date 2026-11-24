// Client-side photo compression: images are shrunk and re-encoded before display or upload.
const MAX_EDGE = 640;
const MAX_CHARS = 240_000;

export async function compressPhoto(file: File): Promise<string | null> {
  try {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      URL.revokeObjectURL(url);
      return null;
    }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    let data = canvas.toDataURL("image/jpeg", 0.72);
    if (data.length > MAX_CHARS) data = canvas.toDataURL("image/jpeg", 0.5);
    if (data.length > MAX_CHARS) return null;
    return data;
  } catch {
    return null;
  }
}

import imageCompression from "browser-image-compression";

const DEFAULT_OPTIONS = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1200,
  useWebWorker: true,
  fileType: "image/webp" as const,
};

/**
 * Compress an image file before upload.
 * Returns a compressed File with .webp extension by default.
 */
export async function compressImage(
  file: File,
  overrides?: Partial<typeof DEFAULT_OPTIONS>
): Promise<File> {
  // Skip non-image files (e.g. SVGs are already small)
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
    return file;
  }

  const options = { ...DEFAULT_OPTIONS, ...overrides };
  const compressed = await imageCompression(file, options);
  return compressed;
}

/** Get the correct extension for a (possibly compressed) file */
export function getFileExtension(file: File): string {
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/png") return "png";
  return file.name.split(".").pop() || "webp";
}

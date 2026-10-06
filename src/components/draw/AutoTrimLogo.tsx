import { useEffect, useState } from "react";

const trimmedLogoCache = new Map<string, string>();
const pendingTrims = new Map<string, Promise<string>>();

async function loadDrawable(src: string): Promise<CanvasImageSource & { width: number; height: number }> {
  // Fetch as blob first: avoids canvas tainting when the same logo was already cached without CORS headers.
  try {
    const response = await fetch(src, { mode: "cors", cache: "no-cache" });
    if (response.ok) return await createImageBitmap(await response.blob());
  } catch {
    // fall through to <img> loading
  }
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(Object.assign(image, { width: image.naturalWidth, height: image.naturalHeight }));
    image.onerror = reject;
    image.src = src;
  });
}

function findContentBox(pixels: Uint8ClampedArray, width: number, height: number) {
  const at = (x: number, y: number) => (y * width + x) * 4;
  const corners = [at(0, 0), at(width - 1, 0), at(0, height - 1), at(width - 1, height - 1)];
  const cornersTransparent = corners.every((index) => pixels[index + 3] <= 24);
  const reference = corners[0];
  const cornersUniform = !cornersTransparent && corners.every((index) =>
    Math.abs(pixels[index] - pixels[reference]) < 14 &&
    Math.abs(pixels[index + 1] - pixels[reference + 1]) < 14 &&
    Math.abs(pixels[index + 2] - pixels[reference + 2]) < 14);

  const isBackground = (index: number) => {
    if (pixels[index + 3] <= 24) return true;
    if (!cornersUniform) return false;
    return Math.abs(pixels[index] - pixels[reference]) < 20 &&
      Math.abs(pixels[index + 1] - pixels[reference + 1]) < 20 &&
      Math.abs(pixels[index + 2] - pixels[reference + 2]) < 20;
  };

  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (isBackground(at(x, y))) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  if (right < left || bottom < top) return null;
  return { left, top, width: right - left + 1, height: bottom - top + 1, keepBackground: cornersUniform };
}

async function trimLogo(src: string): Promise<string> {
  const cached = trimmedLogoCache.get(src);
  if (cached) return cached;
  const pending = pendingTrims.get(src);
  if (pending) return pending;

  const job = (async () => {
    try {
      const drawable = await loadDrawable(src);
      const maxSide = 512;
      const scale = Math.min(1, maxSide / Math.max(drawable.width, drawable.height));
      const width = Math.max(1, Math.round(drawable.width * scale));
      const height = Math.max(1, Math.round(drawable.height * scale));
      const source = document.createElement("canvas");
      source.width = width;
      source.height = height;
      const context = source.getContext("2d", { willReadFrequently: true });
      if (!context) return src;
      context.drawImage(drawable, 0, 0, width, height);
      const box = findContentBox(context.getImageData(0, 0, width, height).data, width, height);
      if (!box) return src;

      // Square output with the content box exactly centered.
      const side = Math.max(box.width, box.height);
      const padding = Math.ceil(side * 0.02);
      const canvasSide = side + padding * 2;
      const output = document.createElement("canvas");
      output.width = canvasSide;
      output.height = canvasSide;
      const outputContext = output.getContext("2d");
      if (!outputContext) return src;
      outputContext.drawImage(
        source,
        box.left, box.top, box.width, box.height,
        (canvasSide - box.width) / 2, (canvasSide - box.height) / 2, box.width, box.height,
      );
      const result = output.toDataURL("image/png");
      trimmedLogoCache.set(src, result);
      return result;
    } catch {
      return src;
    } finally {
      pendingTrims.delete(src);
    }
  })();
  pendingTrims.set(src, job);
  return job;
}

export function AutoTrimLogo({ src, className, alt = "" }: { src: string; className?: string; alt?: string }) {
  const [trimmedSrc, setTrimmedSrc] = useState(() => trimmedLogoCache.get(src) ?? null);

  useEffect(() => {
    let active = true;
    setTrimmedSrc(trimmedLogoCache.get(src) ?? null);
    void trimLogo(src).then((result) => {
      if (active) setTrimmedSrc(result);
    });
    return () => {
      active = false;
    };
  }, [src]);

  if (!trimmedSrc) return null;
  return <img src={trimmedSrc} alt={alt} className={className} />;
}

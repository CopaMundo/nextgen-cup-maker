import { useEffect, useState } from "react";

const trimmedLogoCache = new Map<string, string>();

async function trimTransparentEdges(src: string): Promise<string> {
  const cached = trimmedLogoCache.get(src);
  if (cached) return cached;

  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      const source = document.createElement("canvas");
      source.width = image.naturalWidth;
      source.height = image.naturalHeight;
      const context = source.getContext("2d", { willReadFrequently: true });
      if (!context || source.width === 0 || source.height === 0) {
        resolve(src);
        return;
      }

      try {
        context.drawImage(image, 0, 0);
        const pixels = context.getImageData(0, 0, source.width, source.height).data;
        let left = source.width;
        let top = source.height;
        let right = -1;
        let bottom = -1;

        for (let y = 0; y < source.height; y += 1) {
          for (let x = 0; x < source.width; x += 1) {
            if (pixels[(y * source.width + x) * 4 + 3] <= 8) continue;
            left = Math.min(left, x);
            top = Math.min(top, y);
            right = Math.max(right, x);
            bottom = Math.max(bottom, y);
          }
        }

        if (right < left || bottom < top) {
          resolve(src);
          return;
        }

        const width = right - left + 1;
        const height = bottom - top + 1;
        const padding = Math.max(1, Math.ceil(Math.max(width, height) * 0.04));
        const trimmed = document.createElement("canvas");
        trimmed.width = width + padding * 2;
        trimmed.height = height + padding * 2;
        const trimmedContext = trimmed.getContext("2d");
        if (!trimmedContext) {
          resolve(src);
          return;
        }
        trimmedContext.drawImage(source, left, top, width, height, padding, padding, width, height);
        const result = trimmed.toDataURL("image/png");
        trimmedLogoCache.set(src, result);
        resolve(result);
      } catch {
        resolve(src);
      }
    };
    image.onerror = () => resolve(src);
    image.src = src;
  });
}

export function AutoTrimLogo({ src, className, alt = "" }: { src: string; className?: string; alt?: string }) {
  const [trimmedSrc, setTrimmedSrc] = useState(() => trimmedLogoCache.get(src) ?? src);

  useEffect(() => {
    let active = true;
    setTrimmedSrc(trimmedLogoCache.get(src) ?? src);
    void trimTransparentEdges(src).then((result) => {
      if (active) setTrimmedSrc(result);
    });
    return () => {
      active = false;
    };
  }, [src]);

  return <img src={trimmedSrc} alt={alt} className={className} />;
}
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, Lightformer, OrthographicCamera } from "@react-three/drei";
import { Color, DataTexture, Float32BufferAttribute, RepeatWrapping, SRGBColorSpace } from "three";
import { wallLetterGeometry } from "@/lib/drawWallLettering";

interface MetalPalette { face: string; light: string; reflection: string; shadow: string; highlight: string; }
interface Props { title: string; heading: string; theme: string; }

function WallLetters({ title, heading, theme, palette }: Props & { palette: MetalPalette }) {
  const letters = useMemo(() => [
    { geometry: wallLetterGeometry(heading, .24, 9, .16), y: 1.19 },
    { geometry: wallLetterGeometry(title, 1.28, 11.1, 0, .026), y: .12 },
    { geometry: wallLetterGeometry("POWERED BY COPA MUNDO", .22, 10, .12), y: -.99 },
  ].map(item => {
    // Keep the polished face saturated and readable. A narrow studio reflection
    // adds gloss without letting the recessed edge darken the whole inscription.
    const positions = item.geometry.getAttribute("position");
    const box = item.geometry.boundingBox;
    if (!box) return item;
    const colors = new Float32Array(positions.count * 3);
    const metal = new Color(palette.face);
    const reflection = new Color(palette.reflection);
    const highlight = new Color(palette.highlight);
    for (let i = 0; i < positions.count; i++) {
      const y = (positions.getY(i) - box.min.y) / (box.max.y - box.min.y);
      const shine = Math.exp(-Math.pow((y - .78) / .10, 2));
      const color = metal.clone().lerp(reflection, .12 * (1 - y)).lerp(highlight, shine * .55);
      color.toArray(colors, i * 3);
    }
    item.geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
    return item;
  }), [title, heading, palette]);
  const grain = useMemo(() => {
    const data = new Uint8Array(64 * 64 * 4);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      const i = (y * 64 + x) * 4;
      const value = 170 + Math.round(24 * Math.sin(y * 17.3) + 6 * Math.sin(x * 2.1));
      data[i] = data[i + 1] = data[i + 2] = value; data[i + 3] = 255;
    }
    const texture = new DataTexture(data, 64, 64);
    texture.wrapS = texture.wrapT = RepeatWrapping; texture.repeat.set(3, 8); texture.needsUpdate = true;
    return texture;
  }, []);
  useEffect(() => () => letters.forEach(item => item.geometry.dispose()), [letters]);
  useEffect(() => () => grain.dispose(), [grain]);
  return <>
    <OrthographicCamera makeDefault manual position={[0, 0, 18]} left={-7} right={7} top={1.97} bottom={-1.97} near={.1} far={40} />
    <ambientLight intensity={1.15} />
    <directionalLight position={[-4, 7, 5]} intensity={1.8} />
    <directionalLight position={[6, 2, 4]} intensity={.55} color={palette.light} />
    <Suspense fallback={null}><Environment resolution={64} frames={1}>
      <Lightformer position={[0, 2, 6]} rotation-y={Math.PI} scale={[12, 2, 1]} intensity={1.5} color={palette.light} />
      <Lightformer position={[-2, 5, 5]} rotation-x={.3} scale={[10, 1, 1]} intensity={3} color={palette.highlight} />
      <Lightformer position={[5, 0, 3]} rotation-y={-.8} scale={[3, 6, 1]} intensity={2.5} color={palette.reflection} />
      <Lightformer position={[-5, -2, 2]} rotation-y={.8} scale={[4, 1, 1]} intensity={1.5} color={palette.light} />
    </Environment></Suspense>
    {letters.map(({ geometry, y }, index) => <group key={index} position-y={y} scale-z={.28}>
      <mesh geometry={geometry} position={[0, .009, -.04]} scale={[1.002, 1.006, 1]}><meshBasicMaterial color={palette.highlight} transparent opacity={.25} /></mesh>
      <mesh geometry={geometry} position={[.004, -.012, -.02]} scale={[1.003, 1.008, 1]}><meshBasicMaterial color={palette.shadow} transparent opacity={.6} /></mesh>
      <mesh geometry={geometry}>
        <meshPhysicalMaterial vertexColors metalness={.62} roughness={theme === "copa-gold" ? .19 : .14} roughnessMap={grain} clearcoat={.8} clearcoatRoughness={.1} emissive={palette.face} emissiveIntensity={.12} />
      </mesh>
    </group>)}
  </>;
}

/** Historical export retained; this is unframed, fixed metal lettering, not a halo. */
export function DrawHalo({ title, heading, theme }: Props) {
  const host = useRef<HTMLElement>(null);
  const [palette, setPalette] = useState<MetalPalette | null>(null);
  useEffect(() => {
    if (!host.current) return;
    const css = getComputedStyle(host.current);
    const color = (token: string) => {
      const [h, s, l] = css.getPropertyValue(token).trim().split(/\s+/).map(parseFloat);
      return new Color().setHSL(h / 360, s / 100, l / 100, SRGBColorSpace).getStyle();
    };
    setPalette({ face: color("--stage-letter-metal"), light: color("--stage-metal-light"), reflection: color("--stage-letter-reflection"), shadow: color("--stage-letter-shadow"), highlight: color("--stage-letter-highlight") });
  }, [theme]);
  return <header ref={host} className="draw-show-wall-lettering" role="img" aria-label={`${heading} · ${title} · POWERED BY COPA MUNDO`} data-wall-lettering={title}>
    {palette && <Canvas frameloop="demand" dpr={[1, 2]} gl={{ alpha: true, antialias: true }}><WallLetters title={title} heading={heading} theme={theme} palette={palette} /></Canvas>}
  </header>;
}

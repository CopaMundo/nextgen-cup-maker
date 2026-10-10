import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, Lightformer, OrthographicCamera } from "@react-three/drei";
import { Color, DataTexture, RepeatWrapping, SRGBColorSpace } from "three";
import { wallLetterGeometry } from "@/lib/drawWallLettering";

interface MetalPalette { face: string; light: string; reflection: string; shadow: string; }
interface Props { title: string; heading: string; theme: string; }

function WallLetters({ title, heading, theme, palette }: Props & { palette: MetalPalette }) {
  const letters = useMemo(() => [
    { geometry: wallLetterGeometry(heading, .24, 9, .16), y: 1.05 },
    { geometry: wallLetterGeometry(title, 1.02, 12.1), y: .08 },
    { geometry: wallLetterGeometry("POWERED BY COPA MUNDO", .20, 10, .12), y: -.89 },
  ], [title, heading]);
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
    <ambientLight intensity={.65} color={palette.light} />
    <directionalLight position={[-4, 5, 7]} intensity={3.2} color={palette.light} />
    <directionalLight position={[6, 1, 4]} intensity={1.1} color={palette.reflection} />
    <Suspense fallback={null}><Environment resolution={64} frames={1}>
      <Lightformer position={[0, 2, 6]} rotation-y={Math.PI} scale={[12, 5, 1]} intensity={3} color={palette.light} />
      <Lightformer position={[-2, 5, 5]} rotation-x={.3} scale={[10, 2, 1]} intensity={4} color={palette.light} />
      <Lightformer position={[5, 0, 3]} rotation-y={-.8} scale={[3, 6, 1]} intensity={2} color={palette.reflection} />
      <Lightformer position={[-5, -2, 2]} rotation-y={.8} scale={[4, 1, 1]} intensity={1.5} color={palette.light} />
    </Environment></Suspense>
    {letters.map(({ geometry, y }, index) => <group key={index} position-y={y}>
      <mesh geometry={geometry} position={[.028, -.044, -.07]} scale={[1.012, 1.024, 1]}><meshBasicMaterial color={palette.shadow} transparent opacity={.8} /></mesh>
      <mesh geometry={geometry}>
        <meshPhysicalMaterial color={palette.face} emissive={palette.face} emissiveIntensity={index === 1 ? .24 : .4} metalness={.88} roughness={theme === "copa-gold" ? .32 : .2} roughnessMap={grain} clearcoat={.35} clearcoatRoughness={.2} />
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
    setPalette({ face: color("--stage-letter-metal"), light: color("--stage-metal-light"), reflection: color("--stage-letter-reflection"), shadow: color("--stage-letter-shadow") });
  }, [theme]);
  return <header ref={host} className="draw-show-wall-lettering" role="img" aria-label={`${heading} · ${title} · POWERED BY COPA MUNDO`} data-wall-lettering={title}>
    {palette && <Canvas frameloop="demand" dpr={[1, 2]} gl={{ alpha: true, antialias: true }}><WallLetters title={title} heading={heading} theme={theme} palette={palette} /></Canvas>}
  </header>;
}

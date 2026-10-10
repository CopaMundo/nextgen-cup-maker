import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer, OrthographicCamera } from "@react-three/drei";
import { CanvasTexture, Color, DoubleSide, RepeatWrapping, SRGBColorSpace } from "three";
import { consoleBand, consoleContour } from "@/lib/drawConsoleGeometry";

interface HaloPalette { surface: string; dot: string; text: string; metal: string; light: string; shade: string; }
interface Props { title: string; heading: string; theme: string; }

/** Separate text bands retain a fixed heading and brand while long titles scroll. */
function createDisplay(text: string, size: number, palette: HaloPalette, led = true) {
  const canvas = document.createElement("canvas");
  canvas.width = 4096; canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.font = `600 ${size}px "Barlow Condensed", "Arial Narrow", sans-serif`;
  const titleWidth = ctx.measureText(text.toUpperCase()).width;
  const scrolling = led && titleWidth > 2850;
  canvas.width = Math.max(4096, Math.min(16384, Math.ceil(titleWidth + 1100)));
  if (led) { ctx.fillStyle = palette.surface; ctx.fillRect(0, 0, canvas.width, 512); }
  ctx.fillStyle = palette.dot;
  if (led) for (let y = 6; y < 512; y += 12) for (let x = 6; x < canvas.width; x += 12) {
    ctx.beginPath(); ctx.arc(x, y, 1.4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = `600 ${size}px "Barlow Condensed", "Arial Narrow", sans-serif`;
  ctx.fillStyle = led ? palette.text : palette.light;
  ctx.fillText(text.toUpperCase(), canvas.width / 2, 256);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace; texture.anisotropy = 8;
  texture.wrapS = RepeatWrapping;
  texture.repeat.x = scrolling ? 4096 / canvas.width : 1;
  return { texture, scrolling, period: Math.max(35000, canvas.width / 90 * 1000) };
}

function HaloScene({ title, heading, palette }: Omit<Props, "theme"> & { palette: HaloPalette }) {
  const display = useMemo(() => createDisplay(title, 330, palette), [title, palette]);
  const caption = useMemo(() => createDisplay(heading, 310, palette), [heading, palette]);
  const brand = useMemo(() => createDisplay("POWERED BY COPA MUNDO", 270, palette, false), [palette]);
  const geometry = useMemo(() => ({ body: consoleBand(1.13, -1.02, .45), top: consoleBand(1.13, .77, .45), bottom: consoleBand(-.64, -1.02, .35), screen: consoleBand(.76, -.63, 0), title: consoleBand(.26, -.54, 0), heading: consoleBand(.65, .27, 0), brand: consoleBand(-.69, -.98, 0), upperLight: consoleBand(.81, .79, .03), lowerLight: consoleBand(-1.02, -1.04, .03) }), []);
  useEffect(() => () => { display?.texture.dispose(); caption?.texture.dispose(); brand?.texture.dispose(); }, [display, caption, brand]);
  useEffect(() => () => Object.values(geometry).forEach(item => item.dispose()), [geometry]);
  useFrame(() => {
    // The shared wall clock keeps director and projector lettering aligned.
    if (display?.scrolling) display.texture.offset.x = (Date.now() % display.period) / display.period;
  });
  return <>
    <OrthographicCamera makeDefault manual position={[0, 2.8, 18]} left={-7} right={7} top={1.75} bottom={-1.75} near={.1} far={60} onUpdate={camera => { camera.lookAt(0, 0, 0); camera.updateProjectionMatrix(); }} />
    <ambientLight intensity={1.1} />
    <directionalLight position={[-6, 7, 10]} intensity={3} color={palette.light} />
    <Suspense fallback={null}><Environment resolution={64} frames={1}>
      <Lightformer position={[0, 8, 6]} scale={[12, 3, 1]} intensity={3} color={palette.light} />
      <Lightformer position={[-6, 0, 4]} rotation-y={Math.PI / 3} scale={[3, 6, 1]} intensity={2} color={palette.metal} />
    </Environment></Suspense>
    <mesh geometry={geometry.body}><meshStandardMaterial color={palette.shade} metalness={.85} roughness={.3} /></mesh>
    {[geometry.top, geometry.bottom].map((band, index) => <mesh key={index} geometry={band} position-z={.015}><meshStandardMaterial color={palette.metal} metalness={.92} roughness={.23} /></mesh>)}
    <mesh geometry={geometry.screen} position-z={.03}><meshStandardMaterial color={palette.surface} metalness={.35} roughness={.2} /></mesh>
    <mesh geometry={geometry.title} position-z={.18}><meshBasicMaterial map={display?.texture} toneMapped={false} /></mesh>
    <mesh geometry={geometry.heading} position-z={.18}><meshBasicMaterial map={caption?.texture} toneMapped={false} /></mesh>
    <mesh geometry={geometry.brand} position-z={.18}><meshBasicMaterial map={brand?.texture} transparent toneMapped={false} /></mesh>
    <mesh geometry={geometry.screen} position-z={.2}><meshStandardMaterial color={palette.light} metalness={.65} roughness={.22} transparent opacity={.065} depthWrite={false} /></mesh>
    {[geometry.upperLight, geometry.lowerLight].map((band, index) => <mesh key={index} geometry={band} position-z={.06}><meshBasicMaterial color={palette.light} toneMapped={false} /></mesh>)}
    {[-5.5, -3.3, 0, 3.3, 5.5].map(x => <group key={x} position={[x, -1.08, consoleContour(x).z - .12]}>
      <mesh><cylinderGeometry args={[.12, .16, .22, 12]} /><meshStandardMaterial color={palette.shade} metalness={.8} roughness={.3} /></mesh>
      <mesh position-y={-.12} rotation-x={Math.PI / 2}><circleGeometry args={[.1, 16]} /><meshBasicMaterial color={palette.light} side={DoubleSide} toneMapped={false} /></mesh>
    </group>)}
  </>;
}

export function DrawHalo({ title, heading, theme }: Props) {
  const host = useRef<HTMLElement>(null);
  const [palette, setPalette] = useState<HaloPalette | null>(null);
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    let mounted = true;
    void document.fonts.load('600 330px "Barlow Condensed"').then(() => { if (mounted) setFontsReady(true); });
    return () => { mounted = false; };
  }, []);
  useEffect(() => {
    if (!host.current) return;
    const css = getComputedStyle(host.current);
    const color = (token: string) => {
      const [h, s, l] = css.getPropertyValue(token).trim().split(/\s+/).map(parseFloat);
      return new Color().setHSL(h / 360, s / 100, l / 100, SRGBColorSpace).getStyle();
    };
    setPalette({ surface: color("--stage-led-surface"), dot: color("--stage-led-dot"), text: color("--primary"), metal: color("--stage-metal-main"), light: color("--stage-metal-light"), shade: color("--stage-metal-dark") });
  }, [theme]);
  return <header ref={host} className="draw-show-halo" role="img" aria-label={`${heading} · ${title} · POWERED BY COPA MUNDO`} data-halo-title={title} data-broadcast-console>
    {palette && fontsReady && <Canvas dpr={[1, 1.5]} gl={{ alpha: true, antialias: true }}><HaloScene title={title} heading={heading} palette={palette} /></Canvas>}
  </header>;
}

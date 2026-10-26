"use client";

import { Line, OrthographicCamera, useGLTF } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { CityState } from "@/lib/progress";
import { PressLoop } from "./PressLoop";

/* The run as a tour: the seller's cities become stops on a printed route, and the Overlap tour bus
   drives to each city as the agent starts on it. A city prints in when its evidence is read, and the
   brands that rank there pop up as tags. Flat brand inks, unlit, with ink outlines. */

const INK = "#111216";
const PAPER = "#f3f3f1";
const CORAL = "#ff5a36";
const SPACING = 3.6;
const DRIVE_SPEED = 3.2; // world units per second
const DWELL_S = 1.6;
const BUS_URL = "/models/tour-bus.glb";

export interface TourRouteProps {
  cities: string[];
  states: Record<string, CityState>;
  visitOrder: string[];
  cityBrands: Record<string, { name: string; rank: number }[]>;
  /** The run (or replay) has finished: visit any remaining cities, pull back, then call onFinished. */
  done: boolean;
  onFinished?: () => void;
  /** The bus is the stage's clock: the parent owns where it is and where it has been. */
  here: string | null;
  visited: string[];
  onArrive: (city: string) => void;
  onLeave: () => void;
}

function useLayout(cities: string[]) {
  return useMemo(() => {
    const stops = cities.map((_, i) => new THREE.Vector3(i * SPACING, 0, Math.sin(i * 1.3 + 0.4) * 1.5));
    const first = stops[0] ?? new THREE.Vector3();
    const last = stops.at(-1) ?? new THREE.Vector3();
    const points = [first.clone().add(new THREE.Vector3(-3.2, 0, 0.8)), ...stops, last.clone().add(new THREE.Vector3(2.8, 0, -0.6))];
    const curve = new THREE.CatmullRomCurve3(points, false, "centripetal");
    const samples = curve.getSpacedPoints(600);
    // Arc-length position (0..1) of each stop on the road.
    const stopU = stops.map((p) => {
      let best = 0;
      let bestD = Infinity;
      samples.forEach((s, i) => {
        const d = s.distanceToSquared(p);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      return best / (samples.length - 1);
    });
    return { stops, curve, samples, stopU, length: curve.getLength() };
  }, [cities]);
}

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** DOM labels live outside the canvas; the scene projects their anchors to screen space every frame. */
type Anchors = Map<string, HTMLElement>;

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch {
    return false;
  }
}

export function TourRoute(props: TourRouteProps) {
  const [gl] = useState(hasWebGL);
  if (!gl)
    return (
      <div className="flex h-[15rem] items-center justify-center sm:h-[24rem]">
        <PressLoop className="max-w-[24rem]" />
      </div>
    );
  return <TourRouteCanvas {...props} />;
}

function TourRouteCanvas(props: TourRouteProps) {
  const anchors = useRef<Anchors>(new Map());
  const { here, visited } = props;
  // On a phone the band is too narrow for every city's tags; only the bus's city shows them.
  const [narrow] = useState(() => window.matchMedia("(max-width: 639px)").matches);
  const bind = (key: string) => (el: HTMLElement | null) => {
    if (el) anchors.current.set(key, el);
    else anchors.current.delete(key);
  };
  return (
    <div className="relative h-[15rem] w-full overflow-hidden sm:h-[24rem]">
      <Canvas flat dpr={[1, 2]} gl={{ antialias: true, alpha: true }} aria-hidden="true">
        <Scene {...props} anchors={anchors} />
      </Canvas>
      <div className="pointer-events-none absolute inset-0 select-none" aria-hidden="true">
        {props.cities.map((city) => {
          const tags =
            visited.includes(city) && (!narrow || here === city) ? (props.cityBrands[city] ?? []).slice(0, here === city ? 2 : 1) : [];
          return (
            <div key={city}>
              <span ref={bind(`label:${city}`)} className="absolute left-0 top-0 opacity-0 will-change-transform">
                <span className="display print-line on-paper block -translate-x-1/2 whitespace-nowrap text-[1.35rem] sm:text-[1.6rem]" data-state={props.states[city] ?? "queued"}>
                  {city}
                  <span className="ink">{city}</span>
                </span>
              </span>
              <span ref={bind(`tag:${city}`)} className="absolute left-0 top-0 opacity-0 will-change-transform">
                <span className="flex -translate-x-1/2 -translate-y-full flex-col items-center gap-1">
                  {tags.map((b) => (
                    <span key={b.name} className="tag-pop whitespace-nowrap rounded-[2px] border border-ink bg-sheet px-2 py-0.5 text-xs font-semibold text-ink">
                      {b.name} <span className="font-mono text-evidence tnum">#{b.rank}</span>
                    </span>
                  ))}
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Scene({
  cities,
  states,
  visitOrder,
  done,
  onFinished,
  anchors,
  here,
  onArrive,
  onLeave,
}: TourRouteProps & { anchors: React.RefObject<Anchors> }) {
  const layout = useLayout(cities);
  const { size } = useThree();
  const camRef = useRef<THREE.OrthographicCamera>(null);
  const busRef = useRef<THREE.Group>(null);
  const focus = useRef(new THREE.Vector3(layout.stops[0]?.x ?? 0, 0, 0));
  const nav = useRef({ u: 0, stop: 0, dwell: 0, heading: 1, finishedAt: -1, wheel: 0 });
  const [overview, setOverview] = useState(false);
  const scratch = useMemo(() => new THREE.Vector3(), []);
  const still = useMemo(reducedMotion, []);

  // Every city gets a visit: the agent's own order first, the rest once the run is done.
  const queue = useMemo(() => {
    const q = visitOrder.filter((c) => cities.includes(c));
    if (done) for (const c of cities) if (!q.includes(c)) q.push(c);
    return q;
  }, [visitOrder, cities, done]);

  const offset = useMemo(() => new THREE.Vector3(6, 11, 12), []);
  const followZoom = Math.min(size.width / (SPACING * (size.width < 640 ? 2.5 : 3.8)), size.height / 6.9);
  // The closing overview fits the whole route with margin at both ends and the tallest skylines under the top rule.
  const fitZoom = Math.min(followZoom, size.width / (layout.length * 0.86 + 6.5), size.height / 7.4);

  useFrame((state, dt) => {
    const n = nav.current;
    const step = Math.min(dt, 0.05);
    const goal = queue[n.stop];
    // Before the agent reaches any city, the bus heads out slowly toward the first stop.
    if (!goal && !done && layout.stopU[0] != null) {
      const preRoll = layout.stopU[0] * 0.85;
      if (n.u < preRoll) {
        const move = (DRIVE_SPEED * 0.35 * step) / layout.length;
        n.u = Math.min(preRoll, n.u + move);
        n.heading = 1;
        n.wheel += DRIVE_SPEED * 0.35 * step * 6;
      }
    }
    if (goal) {
      const goalU = layout.stopU[cities.indexOf(goal)] ?? 0;
      const delta = goalU - n.u;
      const move = (DRIVE_SPEED * step) / layout.length;
      if (still) n.u = goalU;
      if (Math.abs(delta) > move) {
        n.u += Math.sign(delta) * move;
        n.heading = Math.sign(delta);
        n.wheel += Math.sign(delta) * DRIVE_SPEED * step * 6;
        if (here) onLeave();
      } else {
        n.u = goalU;
        if (here !== goal) {
          onArrive(goal);
          n.dwell = 0;
        }
        n.dwell += step;
        // Move on once the dwell is over and the next stop is known.
        if (n.dwell > DWELL_S && queue[n.stop + 1]) n.stop += 1;
        else if (n.dwell > DWELL_S && done && n.stop === queue.length - 1 && n.finishedAt < 0) {
          n.finishedAt = state.clock.elapsedTime;
          setOverview(true);
          onLeave();
        }
      }
    }
    if (n.finishedAt > 0 && state.clock.elapsedTime - n.finishedAt > 2.2) {
      n.finishedAt = Infinity;
      onFinished?.();
    }

    const bus = busRef.current;
    if (bus) {
      const p = layout.curve.getPointAt(n.u);
      const t = layout.curve.getTangentAt(n.u).multiplyScalar(n.heading);
      bus.position.set(p.x, 0, p.z);
      const target = Math.atan2(-t.z, t.x);
      bus.rotation.y += (shortAngle(target - bus.rotation.y) * (still ? 1 : 1 - Math.exp(-step * 8)));
      bus.position.y = here ? 0 : Math.abs(Math.sin(state.clock.elapsedTime * 14)) * 0.025;
      bus.traverse((o) => {
        if (o.name.startsWith("Wheel_")) o.rotation.z = -n.wheel;
      });
    }

    const cam = camRef.current;
    if (cam) {
      const want = overview
        ? new THREE.Vector3((layout.stops[0]!.x + layout.stops.at(-1)!.x) / 2, 0, -1.1)
        : bus
          ? // Look a little behind the road so the skylines and tags sit inside the band.
            bus.position.clone().setY(0).add(new THREE.Vector3(0, 0, -1.15))
          : focus.current;
      focus.current.lerp(want, still ? 1 : 1 - Math.exp(-step * 2.4));
      cam.position.copy(focus.current).add(offset);
      cam.lookAt(focus.current);
      const z = overview ? fitZoom : followZoom;
      cam.zoom += (z - cam.zoom) * (still ? 1 : 1 - Math.exp(-step * 2));
      cam.updateProjectionMatrix();
      cam.updateMatrixWorld();

      // Place the DOM labels: city names just in front of each stop, brand tags above it.
      const place = (key: string, p: THREE.Vector3, minY = 0, maxY = size.height, padX = 0) => {
        const el = anchors.current?.get(key);
        if (!el) return;
        scratch.copy(p).project(cam);
        let x = ((scratch.x + 1) / 2) * size.width;
        // Keep a centred element whole near the edges, but let it leave once its city has left the band.
        if (padX && x > -padX / 2 && x < size.width + padX / 2) x = Math.min(size.width - padX, Math.max(padX, x));
        const y = Math.min(maxY, Math.max(minY, ((1 - scratch.y) / 2) * size.height));
        el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
        el.style.opacity = "1";
      };
      cities.forEach((city, i) => {
        const s = layout.stops[i]!;
        // Labels stay above the bottom rule; tags (up to two, about 50px tall) stay 16px below the top rule.
        place(`label:${city}`, new THREE.Vector3(s.x, 0, s.z + 0.95), 0, size.height - 30);
        place(`tag:${city}`, new THREE.Vector3(s.x, 0.9, s.z - 0.2), 66, size.height, 92);
      });
    }
  });

  return (
    <>
      <OrthographicCamera ref={camRef} makeDefault zoom={followZoom} near={-100} far={200} position={[6, 11, 12]} />
      <Road samples={layout.samples} />
      {cities.map((city, i) => (
        <group key={city}>
          <Stop position={layout.stops[i]!} state={states[city] ?? "queued"} here={here === city} still={still} />
          <Skyline city={city} position={layout.stops[i]!} state={states[city] ?? "queued"} />
        </group>
      ))}
      <Suspense fallback={null}>
        <group ref={busRef}>
          <Bus />
        </group>
      </Suspense>
    </>
  );
}

function shortAngle(a: number) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

function Road({ samples }: { samples: THREE.Vector3[] }) {
  const pts = useMemo(() => samples.map((p) => [p.x, -0.02, p.z] as [number, number, number]), [samples]);
  return (
    <>
      <Line points={pts} color={INK} lineWidth={18} />
      <Line points={pts} color={PAPER} lineWidth={1.6} dashed dashSize={0.32} gapSize={0.28} position={[0, 0.005, 0]} />
    </>
  );
}

function Stop({ position, state, here, still }: { position: THREE.Vector3; state: CityState; here: boolean; still: boolean }) {
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const r = ring.current;
    if (!r) return;
    r.visible = here && !still;
    const k = (clock.elapsedTime * 0.9) % 1;
    r.scale.setScalar(1 + k * 1.3);
    (r.material as THREE.MeshBasicMaterial).opacity = 1 - k;
  });
  const printed = state === "printed";
  return (
    <group position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[0.62, 40]} />
        <meshBasicMaterial color={printed ? INK : PAPER} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <ringGeometry args={[0.56, 0.64, 40]} />
        <meshBasicMaterial color={here ? CORAL : INK} />
      </mesh>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
        <ringGeometry args={[0.6, 0.66, 48]} />
        <meshBasicMaterial color={CORAL} transparent />
      </mesh>
    </group>
  );
}

/** A few flat blocks behind each stop, shaped from the city's name so every city keeps its own skyline.
    Outline only while queued, coral outline while the agent is there, solid ink once printed. */
function Skyline({ city, position, state }: { city: string; position: THREE.Vector3; state: CityState }) {
  const blocks = useMemo(() => {
    let h = 2166136261;
    for (const ch of city) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    const rand = () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0) % 1000) / 1000;
    const count = 4 + Math.floor(rand() * 3);
    return Array.from({ length: count }, (_, i) => {
      const w = 0.28 + rand() * 0.22;
      return { x: -0.95 + (i * 1.9) / (count - 1), h: 0.35 + rand() * 1.15, w, d: 0.3 + rand() * 0.25 };
    });
  }, [city]);
  const geos = useMemo(() => blocks.map((b) => new THREE.BoxGeometry(b.w, b.h, b.d)), [blocks]);
  const edges = useMemo(() => geos.map((g) => new THREE.EdgesGeometry(g)), [geos]);
  useEffect(
    () => () => {
      geos.forEach((g) => g.dispose());
      edges.forEach((g) => g.dispose());
    },
    [geos, edges],
  );
  // The ink layer prints up from the ground over the outline, like a pull of the squeegee.
  const ink = useRef<THREE.Group>(null);
  const still = useMemo(reducedMotion, []);
  useFrame((_, dt) => {
    const g = ink.current;
    if (!g) return;
    const target = state === "printed" ? 1 : 0;
    const k = still ? 1 : 1 - Math.exp(-Math.min(dt, 0.05) * 4.5);
    g.scale.y += (target - g.scale.y) * k;
    if (Math.abs(target - g.scale.y) < 0.002) g.scale.y = target;
    g.visible = g.scale.y > 0.01;
  });
  const line = state === "working" ? CORAL : INK;
  return (
    <group position={[position.x, 0, position.z - 1.35]}>
      {blocks.map((b, i) => (
        <group key={i} position={[b.x, b.h / 2, (i % 2) * 0.22]}>
          <mesh geometry={geos[i]}>
            <meshBasicMaterial color={PAPER} />
          </mesh>
          <lineSegments geometry={edges[i]}>
            <lineBasicMaterial color={line} />
          </lineSegments>
        </group>
      ))}
      <group ref={ink} scale={[1, 0, 1]}>
        {blocks.map((b, i) => (
          <group key={i} position={[b.x, b.h / 2, (i % 2) * 0.22]} scale={1.004}>
            <mesh geometry={geos[i]}>
              <meshBasicMaterial color={INK} />
            </mesh>
            <lineSegments geometry={edges[i]}>
              <lineBasicMaterial color={PAPER} />
            </lineSegments>
          </group>
        ))}
      </group>
    </group>
  );
}

function Bus() {
  const { scene } = useGLTF(BUS_URL);
  const model = useMemo(() => {
    const root = scene.clone(true);
    const edges = new THREE.LineBasicMaterial({ color: INK });
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const src = mesh.material as THREE.MeshStandardMaterial;
      // Unlit flat ink: the brand colours exactly, no shading.
      mesh.material = new THREE.MeshBasicMaterial({
        color: src.color,
        map: src.map ?? null,
        transparent: src.transparent,
        alphaTest: src.map ? 0.5 : 0,
        side: THREE.DoubleSide,
      });
      if (!src.map) mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 28), edges));
    });
    root.scale.setScalar(0.62);
    return root;
  }, [scene]);
  useEffect(() => () => model.traverse((o) => (o as THREE.Mesh).geometry?.dispose?.()), [model]);
  return <primitive object={model} />;
}

useGLTF.preload(BUS_URL);

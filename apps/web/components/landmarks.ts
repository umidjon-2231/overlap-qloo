import * as THREE from "three";

/* Low-poly landmark silhouettes for well-known tour cities, built from a handful of primitives so they
   print like the rest of the stage: paper fill, ink edges, then solid ink. Any other city gets a skyline
   shaped from its name. Units: the skyline sits in about x ±1, z ±0.4, up to 1.75 tall. */

export interface Part {
  geo: THREE.BufferGeometry;
  at: [number, number, number];
  rot?: [number, number, number];
}

const SEG = 8;

const box = (w: number, h: number, d: number, x = 0, z = 0, y0 = 0, rot?: Part["rot"]): Part => ({
  geo: new THREE.BoxGeometry(w, h, d),
  at: [x, y0 + h / 2, z],
  rot,
});
const cyl = (rTop: number, rBot: number, h: number, x = 0, z = 0, y0 = 0, seg = SEG, rot?: Part["rot"]): Part => ({
  geo: new THREE.CylinderGeometry(rTop, rBot, h, seg),
  at: [x, y0 + h / 2, z],
  rot,
});
const cone = (r: number, h: number, x = 0, z = 0, y0 = 0, seg = SEG, rot?: Part["rot"]): Part => ({
  geo: new THREE.ConeGeometry(r, h, seg),
  at: [x, y0 + h / 2, z],
  rot,
});
/** A square frustum (four-sided, turned to face the camera square-on). */
const frustum = (rTop: number, rBot: number, h: number, x = 0, z = 0, y0 = 0) => cyl(rTop, rBot, h, x, z, y0, 4, [0, Math.PI / 4, 0]);
const dome = (r: number, x = 0, z = 0, y0 = 0): Part => ({
  geo: new THREE.SphereGeometry(r, SEG, 4, 0, Math.PI * 2, 0, Math.PI / 2),
  at: [x, y0, z],
});
const ball = (r: number, x = 0, z = 0, y = 0): Part => ({ geo: new THREE.SphereGeometry(r, SEG, 6), at: [x, y, z] });
const tube = (pts: [number, number, number][], r: number, seg = 24): Part => ({
  geo: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), seg, r, 4),
  at: [0, 0, 0],
});
const shell = (r: number, x: number): Part => ({
  geo: new THREE.SphereGeometry(r, 8, 4, 0, Math.PI, 0, Math.PI / 2).scale(1, 1.7, 1),
  at: [x, 0.12, 0],
  rot: [0, -Math.PI / 2, 0],
});
const palm = (x: number, z: number, h = 0.8): Part[] => [
  cyl(0.025, 0.04, h, x, z, 0, 5),
  // A drooping crown: an upturned cone reads as fronds hanging down.
  cone(0.26, 0.13, x, z, h - 0.1, 6, [Math.PI, 0, 0]),
];
const needle = (shaft: number, podY: number, podR: number, x = 0, z = 0): Part[] => [
  cyl(0.05, 0.13, shaft, x, z, 0, 6),
  cyl(podR, podR * 0.75, 0.12, x, z, podY, 10),
  cyl(0.012, 0.012, 1.75 - shaft, x, z, shaft, 4),
];

type Build = () => Part[];

const LANDMARKS: Record<string, Build> = {
  london: () => [
    // Elizabeth Tower and the London Eye.
    box(0.24, 1.05, 0.24, -0.45),
    box(0.3, 0.24, 0.3, -0.45, 0, 1.05),
    frustum(0.02, 0.2, 0.42, -0.45, 0, 1.29),
    { geo: new THREE.TorusGeometry(0.55, 0.035, 4, 28), at: [0.45, 0.66, 0.05] },
    box(0.04, 0.72, 0.04, 0.32, 0.05, 0, [0, 0, -0.18]),
    box(0.04, 0.72, 0.04, 0.58, 0.05, 0, [0, 0, 0.18]),
  ],
  paris: () => [
    frustum(0.26, 0.55, 0.42),
    frustum(0.12, 0.24, 0.5, 0, 0, 0.42),
    frustum(0.03, 0.11, 0.62, 0, 0, 0.92),
    cyl(0.008, 0.008, 0.2, 0, 0, 1.54, 4),
    box(0.6, 0.05, 0.6, 0, 0, 0.4, [0, Math.PI / 4, 0]),
  ],
  "new york": () => [
    box(0.56, 0.75, 0.4),
    box(0.42, 0.42, 0.32, 0, 0, 0.75),
    box(0.26, 0.24, 0.22, 0, 0, 1.17),
    cyl(0.07, 0.09, 0.12, 0, 0, 1.41),
    cone(0.04, 0.22, 0, 0, 1.53, 4),
    box(0.34, 0.55, 0.3, 0.72, 0.05),
    box(0.28, 0.85, 0.3, -0.7, 0.1),
  ],
  chicago: () => [
    // Willis Tower's bundled tubes, then the Hancock's tapered shaft.
    box(0.17, 1.4, 0.17, -0.5, -0.09),
    box(0.17, 1.2, 0.17, -0.33, -0.09),
    box(0.17, 0.95, 0.17, -0.5, 0.08),
    box(0.17, 0.7, 0.17, -0.33, 0.08),
    cyl(0.008, 0.008, 0.3, -0.53, -0.09, 1.4, 4),
    cyl(0.008, 0.008, 0.3, -0.47, -0.09, 1.4, 4),
    frustum(0.17, 0.27, 1.1, 0.42),
    cyl(0.008, 0.008, 0.35, 0.39, 0, 1.1, 4),
    cyl(0.008, 0.008, 0.35, 0.45, 0, 1.1, 4),
  ],
  seattle: () => [
    cyl(0.04, 0.12, 1.15, 0, 0, 0, 3),
    cyl(0.36, 0.22, 0.1, 0, 0, 1.15, 12),
    cyl(0.18, 0.3, 0.06, 0, 0, 1.25, 12),
    cone(0.03, 0.25, 0, 0, 1.31, 4),
    box(0.3, 0.6, 0.3, 0.7, 0.1),
    box(0.26, 0.45, 0.26, -0.68, 0.12),
  ],
  toronto: () => [...needle(1.1, 1.0, 0.2), box(0.3, 0.55, 0.3, 0.65, 0.1), box(0.4, 0.4, 0.3, -0.65, 0.1)],
  seoul: () => [cone(0.45, 0.32, 0, 0.05, 0, 6), ...needle(1.15, 1.05, 0.15)],
  berlin: () => [
    cyl(0.06, 0.1, 1.0, 0, 0, 0, 6),
    ball(0.2, 0, 0, 1.12),
    cyl(0.015, 0.03, 0.5, 0, 0, 1.25, 4),
    box(0.5, 0.25, 0.3, -0.6, 0.1),
    box(0.4, 0.35, 0.3, 0.6, 0.1),
  ],
  "los angeles": () => [
    cyl(0.22, 0.24, 1.3, -0.35, -0.05, 0, 10),
    cyl(0.17, 0.2, 0.1, -0.35, -0.05, 1.3, 10),
    box(0.3, 0.75, 0.3, 0.15, -0.1),
    ...palm(0.55, 0.15, 0.9),
    ...palm(0.85, 0.05, 0.75),
    ...palm(-0.85, 0.15, 0.7),
  ],
  miami: () => [
    // An Ocean Drive deco front between palms.
    box(0.9, 0.5, 0.32, 0, 0.05),
    box(0.22, 0.38, 0.34, 0, 0.05, 0.5),
    box(0.1, 0.18, 0.1, 0, 0.05, 0.88),
    box(0.9, 0.04, 0.36, 0, 0.05, 0.28),
    box(0.3, 1.15, 0.3, 0.1, -0.35),
    ...palm(-0.7, 0.15, 0.85),
    ...palm(0.7, 0.2, 0.95),
  ],
  austin: () => [
    // Texas State Capitol.
    box(1.4, 0.3, 0.4),
    box(0.46, 0.18, 0.44, 0, 0, 0.3),
    cyl(0.2, 0.22, 0.3, 0, 0, 0.48),
    dome(0.22, 0, 0, 0.78),
    cyl(0.05, 0.06, 0.18, 0, 0, 0.98),
    cone(0.04, 0.12, 0, 0, 1.16, 4),
  ],
  washington: () => [
    frustum(0.07, 0.11, 1.35, -0.55),
    frustum(0.0, 0.07, 0.12, -0.55, 0, 1.35),
    box(1.0, 0.25, 0.35, 0.35),
    cyl(0.18, 0.2, 0.22, 0.35, 0, 0.25),
    dome(0.2, 0.35, 0, 0.47),
  ],
  "mexico city": () => [
    // El Ángel de la Independencia and Torre Latinoamericana.
    box(0.36, 0.2, 0.36, -0.45),
    cyl(0.06, 0.07, 1.05, -0.45, 0, 0.2, 8),
    box(0.11, 0.08, 0.11, -0.45, 0, 1.25),
    cone(0.06, 0.16, -0.45, 0, 1.33, 4),
    box(0.4, 1.0, 0.4, 0.45, -0.05),
    box(0.3, 0.2, 0.3, 0.45, -0.05, 1.0),
    cyl(0.01, 0.01, 0.35, 0.45, -0.05, 1.2, 4),
  ],
  madrid: () => [
    // Puerta de Europa: the two leaning KIO towers.
    // Rotated about their centres, so the bases sit about ±0.6 and the tops lean in without touching.
    box(0.32, 1.25, 0.32, -0.48, 0, -0.01, [0, 0, -0.2]),
    box(0.32, 1.25, 0.32, 0.48, 0, -0.01, [0, 0, 0.2]),
  ],
  barcelona: () => [
    cyl(0.06, 0.09, 1.2, -0.3, 0, 0, 6),
    cone(0.09, 0.3, -0.3, 0, 1.2, 6),
    cyl(0.06, 0.09, 1.45, -0.1, -0.05, 0, 6),
    cone(0.09, 0.3, -0.1, -0.05, 1.45, 6),
    cyl(0.06, 0.09, 1.45, 0.1, -0.05, 0, 6),
    cone(0.09, 0.3, 0.1, -0.05, 1.45, 6),
    cyl(0.06, 0.09, 1.2, 0.3, 0, 0, 6),
    cone(0.09, 0.3, 0.3, 0, 1.2, 6),
    box(0.9, 0.45, 0.4, 0, 0.1),
  ],
  rome: () => [
    { geo: new THREE.CylinderGeometry(0.62, 0.62, 0.5, 16, 1, true), at: [0, 0.25, 0] },
    { geo: new THREE.CylinderGeometry(0.62, 0.62, 0.18, 16, 1, true), at: [0, 0.59, -0.04] },
  ],
  amsterdam: () =>
    [-0.75, -0.45, -0.15, 0.15, 0.45, 0.75].flatMap((x, i) => {
      const h = 0.55 + ((i * 7) % 4) * 0.12;
      return [
        box(0.28, h, 0.36, x),
        { geo: new THREE.CylinderGeometry(0.17, 0.17, 0.36, 3), at: [x, h + 0.08, 0], rot: [Math.PI / 2, 0, 0] } as Part,
      ];
    }),
  tokyo: () => [
    frustum(0.18, 0.5, 0.55),
    box(0.4, 0.1, 0.4, 0, 0, 0.55, [0, Math.PI / 4, 0]),
    frustum(0.06, 0.16, 0.55, 0, 0, 0.65),
    box(0.16, 0.06, 0.16, 0, 0, 1.2, [0, Math.PI / 4, 0]),
    frustum(0.01, 0.05, 0.45, 0, 0, 1.26),
    box(0.3, 0.6, 0.3, 0.75, 0.1),
    box(0.3, 0.8, 0.3, -0.75, 0.05),
  ],
  dubai: () => [
    box(0.36, 0.5, 0.36),
    box(0.27, 0.45, 0.27, 0, 0, 0.5),
    box(0.18, 0.4, 0.18, 0, 0, 0.95),
    box(0.1, 0.25, 0.1, 0, 0, 1.35),
    cone(0.04, 0.15, 0, 0, 1.6, 4),
  ],
  singapore: () => [
    box(0.2, 0.95, 0.28, -0.4),
    box(0.2, 0.95, 0.28, 0, 0),
    box(0.2, 0.95, 0.28, 0.4),
    box(1.25, 0.06, 0.3, 0.08, 0, 0.95),
  ],
  sydney: () => [
    box(1.3, 0.12, 0.5),
    // Sails: half-domes stood on end, open side to the harbour, stepping down.
    shell(0.5, -0.42),
    shell(0.42, -0.06),
    shell(0.34, 0.24),
    shell(0.26, 0.48),
  ],
  "san francisco": () => [
    box(0.08, 1.3, 0.1, -0.5),
    box(0.08, 1.3, 0.1, 0.5),
    box(2.0, 0.05, 0.16, 0, 0, 0.45),
    tube([[-1.0, 0.5, 0], [-0.5, 1.28, 0], [0, 0.6, 0], [0.5, 1.28, 0], [1.0, 0.5, 0]], 0.015, 40),
  ],
  "st louis": () => [
    tube(
      Array.from({ length: 13 }, (_, i) => {
        const x = -0.6 + (i / 12) * 1.2;
        return [x, 1.5 * (1 - (x / 0.6) ** 2) * 0.98 + 0.01, 0] as [number, number, number];
      }),
      0.04,
      36,
    ),
  ],
  nashville: () => [
    // The AT&T "Batman" building.
    box(0.5, 0.9, 0.34),
    frustum(0.12, 0.22, 0.22, 0, 0, 0.9),
    cone(0.04, 0.5, -0.16, 0, 0.9, 4),
    cone(0.04, 0.5, 0.16, 0, 0.9, 4),
    box(0.3, 0.45, 0.3, 0.7, 0.1),
    box(0.3, 0.6, 0.3, -0.7, 0.1),
  ],
  "buenos aires": () => [frustum(0.04, 0.12, 1.4), frustum(0, 0.05, 0.12, 0, 0, 1.4), box(0.35, 0.4, 0.3, 0.65, 0.1), box(0.35, 0.3, 0.3, -0.65, 0.1)],
  "rio de janeiro": () => [
    cone(0.62, 0.8, 0, 0.05, 0, 6),
    box(0.08, 0.42, 0.08, 0, 0.05, 0.78),
    box(0.55, 0.06, 0.06, 0, 0.05, 1.08),
  ],
};

const ALIASES: Record<string, string> = {
  nyc: "new york",
  "new york city": "new york",
  manhattan: "new york",
  brooklyn: "new york",
  la: "los angeles",
  hollywood: "los angeles",
  cdmx: "mexico city",
  "ciudad de mexico": "mexico city",
  "washington dc": "washington",
  "washington d c": "washington",
  sf: "san francisco",
  "saint louis": "st louis",
  "st. louis": "st louis",
  rio: "rio de janeiro",
  "miami beach": "miami",
};

function key(city: string) {
  const k = city
    .split(",")[0]!
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z .]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return ALIASES[k] ?? k.replace(/\./g, "");
}

export function hasLandmark(city: string) {
  return key(city) in LANDMARKS;
}

/** Blocks shaped from the city's name, so a city keeps the same skyline on every visit. */
function nameBlocks(city: string, count: number, maxH: number, spread: number, skipCentre = false): Part[] {
  let h = 2166136261;
  for (const ch of city) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const rand = () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0) % 1000) / 1000;
  const parts: Part[] = [];
  for (let i = 0; i < count; i++) {
    const w = 0.28 + rand() * 0.22;
    const height = 0.35 + rand() * (maxH - 0.35);
    const d = 0.3 + rand() * 0.25;
    let x = -spread + (i * spread * 2) / Math.max(1, count - 1);
    if (skipCentre) x = (i < count / 2 ? -1 : 1) * (spread - (i % Math.ceil(count / 2)) * 0.35);
    parts.push(box(w, height, d, x, (i % 2) * 0.22));
  }
  return parts;
}

export function cityParts(city: string): Part[] {
  const build = LANDMARKS[key(city)];
  if (!build) return nameBlocks(city, 4 + (city.length % 3), 1.5, 0.95);
  // A low back row so the landmark stands in a city, not on its own.
  const back = nameBlocks(city, 4, 0.6, 1.05, true).map((p) => ({ ...p, at: [p.at[0], p.at[1], p.at[2] - 0.6] as Part["at"] }));
  return [...build(), ...back];
}

// Each row is a ground landmark along the direction of flight, in 256-unit map coordinates.
// Side landmarks leave an open sight line for the small orange enemy shots.
const sectors = [
  [],
  [
    [0, 39, 47],
    [1, 200, 56],
    [0, 112, 35],
    [0, 211, 48],
    [1, 46, 61],
    [0, 158, 40],
  ],
  [
    [3, 19, 71],
    [2, 186, 58],
    [3, 225, 87],
    [2, 52, 52],
    [2, 143, 39],
    [3, 210, 63],
  ],
  [
    [5, 53, 48],
    [4, 215, 78],
    [5, 136, 44],
    [4, 24, 85],
    [5, 203, 53],
    [4, 67, 59],
  ],
  [
    [6, 22, 95],
    [7, 195, 67],
    [6, 239, 88],
    [7, 67, 47],
    [6, 173, 65],
    [7, 116, 44],
  ],
  [
    [9, 31, 64],
    [8, 197, 71],
    [9, 137, 45],
    [8, 51, 60],
    [9, 225, 70],
    [8, 105, 56],
  ],
  [
    [10, 42, 75],
    [11, 197, 51],
    [10, 223, 82],
    [11, 100, 55],
    [10, 65, 59],
    [11, 159, 48],
  ],
  [
    [12, 18, 64],
    [13, 239, 53],
    [12, 225, 62],
    [13, 19, 44],
    [12, 34, 51],
    [13, 221, 59],
  ],
  [
    [14, 54, 61],
    [15, 214, 57],
    [14, 126, 46],
    [15, 28, 70],
    [14, 208, 62],
    [15, 107, 47],
  ],
];
const rowSpacing = [0, 118, 95, 136, 85, 104, 122, 151, 100];
// Flight frames from the appearance of the area banner to the near edge of the planet.
export const ENTRY_FRAME = [0, 1392, 832, 804, 812, 514, 513, 0, 0];
export function visibleTerrain(area, scroll, areaTick) {
  const route = sectors[area];
  if (!route.length || areaTick < ENTRY_FRAME[area]) return [];
  const travelled = scroll - ENTRY_FRAME[area] * 0.54;
  const spacing = rowSpacing[area],
    first = Math.max(0, Math.ceil((travelled - 275) / spacing));
  const last = Math.floor((travelled + 40) / spacing);
  const marks = [];
  for (let row = first; row <= last; row++) {
    const [tile, side, width] = route[row % route.length];
    const turn = Math.floor(row / route.length);
    const x = turn % 2 ? 256 - side : side;
    marks.push({ tile, x, y: travelled - row * spacing, width, turn: ((row % 3) - 1) * 0.08 });
  }
  return marks;
}

export function solarSide(row) {
  return Math.floor(row / 3) % 2 === 0 ? 1 : -1;
}
export function sunAt(scroll, y) {
  return solarSide(Math.ceil((scroll - y) / 240));
}

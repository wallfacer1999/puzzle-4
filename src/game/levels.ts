import type { LevelConfig, PieceTemplate, Point, TargetPieceState } from './types';

const unitScale = 7;
const boardWidth = 750;
const boardHeight = 1240;
const targetOrigin = {
  x: boardWidth / 2 - (79.2 * unitScale) / 2,
  y: boardHeight / 2 - (107.2 * unitScale) / 2,
};

type ExactPieceSpec = {
  id: string;
  points: Point[];
};

const exactPieceSpecs: ExactPieceSpec[] = [
  {
    id: 'piece-a',
    points: [
      { x: 0, y: 0 },
      { x: 39.6, y: 0 },
      { x: 11.6, y: 28 },
      { x: 0, y: 28 },
    ],
  },
  {
    id: 'piece-b',
    points: [
      { x: 39.6, y: 0 },
      { x: 79.2, y: 0 },
      { x: 23.2, y: 56 },
      { x: 23.2, y: 28 },
      { x: 11.6, y: 28 },
    ],
  },
  {
    id: 'piece-c',
    points: [
      { x: 79.2, y: 0 },
      { x: 79.2, y: 28 },
      { x: 51.2, y: 28 },
    ],
  },
  {
    id: 'piece-d',
    points: [
      { x: 51.2, y: 28 },
      { x: 51.2, y: 107.2 },
      { x: 23.2, y: 107.2 },
      { x: 23.2, y: 56 },
    ],
  },
];

function getBounds(points: Point[]) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

function formatPercent(value: number): string {
  return `${Number(value.toFixed(4))}%`;
}

function toPolygon(points: Point[]): string {
  const bounds = getBounds(points);
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;

  return points
    .map((point) => {
      const x = ((point.x - bounds.minX) / width) * 100;
      const y = ((point.y - bounds.minY) / height) * 100;
      return `${formatPercent(x)} ${formatPercent(y)}`;
    })
    .join(', ');
}

function toLocalVertices(points: Point[]): Point[] {
  const bounds = getBounds(points);
  return points.map((point) => ({
    x: (point.x - bounds.minX) * unitScale,
    y: (point.y - bounds.minY) * unitScale,
  }));
}

function getPolygonCentroid(points: Point[]): Point {
  let signedArea = 0;
  let cx = 0;
  let cy = 0;

  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const cross = current.x * next.y - next.x * current.y;
    signedArea += cross;
    cx += (current.x + next.x) * cross;
    cy += (current.y + next.y) * cross;
  }

  signedArea *= 0.5;

  if (Math.abs(signedArea) < 0.0001) {
    const sum = points.reduce(
      (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
      { x: 0, y: 0 },
    );
    return {
      x: sum.x / points.length,
      y: sum.y / points.length,
    };
  }

  return {
    x: cx / (6 * signedArea),
    y: cy / (6 * signedArea),
  };
}

function toLocalActionCenter(points: Point[]): Point {
  const bounds = getBounds(points);
  const centroid = getPolygonCentroid(points);
  return {
    x: (centroid.x - bounds.minX) * unitScale,
    y: (centroid.y - bounds.minY) * unitScale,
  };
}

const easyColors = ['#5f82f2', '#f0a23a', '#26b6a8', '#df5d77'];
const woodColor = '#d8a05a';

function toPiece(spec: ExactPieceSpec, index: number, difficulty: LevelConfig['difficulty']): PieceTemplate {
  const bounds = getBounds(spec.points);
  return {
    id: spec.id,
    color: difficulty === 'easy' ? easyColors[index] : woodColor,
    texture: difficulty === 'easy',
    textureUrl: difficulty === 'normal' ? '/static/textures/wood-grain.jpg' : undefined,
    width: (bounds.maxX - bounds.minX) * unitScale,
    height: (bounds.maxY - bounds.minY) * unitScale,
    polygon: toPolygon(spec.points),
    vertices: toLocalVertices(spec.points),
    actionCenter: toLocalActionCenter(spec.points),
  };
}

function toTarget(spec: ExactPieceSpec): TargetPieceState {
  const bounds = getBounds(spec.points);
  return {
    id: spec.id,
    x: targetOrigin.x + ((bounds.minX + bounds.maxX) / 2) * unitScale,
    y: targetOrigin.y + ((bounds.minY + bounds.maxY) / 2) * unitScale,
    rotation: 0,
    flipped: false,
  };
}

function createLevel(difficulty: LevelConfig['difficulty']): LevelConfig {
  return {
    id: `t-four-pieces-${difficulty}`,
    name: difficulty === 'easy' ? '简单版' : '默认挑战',
    difficulty,
    showTarget: difficulty === 'easy',
    boardWidth,
    boardHeight,
    timeLimitSeconds: 99,
    countdownEnabled: true,
    pieces: exactPieceSpecs.map((spec, index) => toPiece(spec, index, difficulty)),
    targets: exactPieceSpecs.map(toTarget),
    tolerance: {
      position: 42,
      angle: 14,
      requireFlip: false,
      allowAnyPieceOrder: false,
      outsideAreaRatio: 0.08,
      overlapAreaRatio: 0.018,
      uncoveredAreaRatio: 0.08,
      targetMismatchRatio: 0.08,
      areaSampleStep: 8,
      translationSearchRadius: 18,
    },
  };
}

export const normalLevel = createLevel('normal');
export const easyLevel = createLevel('easy');
export const tLevel = normalLevel;

export const levels = [normalLevel, easyLevel];

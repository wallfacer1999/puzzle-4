import type {
  AreaSolveSummary,
  PieceSolveIssue,
  PieceState,
  Point,
  SolveTolerance,
  TargetPieceState,
} from './types';

export function normalizeAngle(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

export function angleDistance(a: number, b: number): number {
  const diff = Math.abs(normalizeAngle(a) - normalizeAngle(b));
  return Math.min(diff, 360 - diff);
}

export function positionDistance(
  a: Pick<PieceState, 'x' | 'y'>,
  b: Pick<TargetPieceState, 'x' | 'y'>,
): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function isSolved(
  pieces: PieceState[],
  targets: TargetPieceState[],
  tolerance: SolveTolerance,
): boolean {
  return getAreaSolveSummary(pieces, targets, tolerance).solved;
}

export function isPositionSolved(
  pieces: PieceState[],
  targets: TargetPieceState[],
  tolerance: SolveTolerance,
): boolean {
  if (tolerance.allowAnyPieceOrder) {
    return matchAnyPieceOrder(pieces, targets, tolerance).solved;
  }

  return targets.every((target) => {
    const piece = pieces.find((item) => item.id === target.id);
    if (!piece) {
      return false;
    }

    const positionOk = positionDistance(piece, target) <= tolerance.position;
    const angleOk = angleDistance(piece.rotation, target.rotation) <= tolerance.angle;
    const flipOk = !tolerance.requireFlip || piece.flipped === target.flipped;

    return positionOk && angleOk && flipOk;
  });
}

export function getAreaSolveSummary(
  pieces: PieceState[],
  targets: TargetPieceState[],
  tolerance: SolveTolerance,
): AreaSolveSummary {
  const piecePolygons = pieces.map((piece) => getPiecePolygon(piece));
  const targetPolygons = targets
    .map((target) => {
      const template = pieces.find((piece) => piece.id === target.id);
      return template ? getPiecePolygon({ ...template, ...target }) : [];
    })
    .filter((polygon) => polygon.length > 0);

  const bounds = getBounds([...piecePolygons.flat(), ...targetPolygons.flat()]);
  const step = tolerance.areaSampleStep || 7;
  let pieceArea = 0;
  let targetArea = 0;
  let outsideArea = 0;
  let overlapArea = 0;
  let uncoveredArea = 0;

  for (let y = bounds.minY; y <= bounds.maxY; y += step) {
    for (let x = bounds.minX; x <= bounds.maxX; x += step) {
      const point = { x: x + step / 2, y: y + step / 2 };
      const pieceCoverCount = piecePolygons.reduce(
        (count, polygon) => count + (pointInPolygon(point, polygon) ? 1 : 0),
        0,
      );
      const inPiece = pieceCoverCount > 0;
      const inTarget = targetPolygons.some((polygon) => pointInPolygon(point, polygon));

      if (inPiece) {
        pieceArea += 1;
      }
      if (inTarget) {
        targetArea += 1;
      }
      if (inPiece && !inTarget) {
        outsideArea += 1;
      }
      if (pieceCoverCount > 1) {
        overlapArea += 1;
      }
      if (inTarget && !inPiece) {
        uncoveredArea += 1;
      }
    }
  }

  const outsideAreaRatio = pieceArea > 0 ? outsideArea / pieceArea : 1;
  const overlapAreaRatio = pieceArea > 0 ? overlapArea / pieceArea : 1;
  const uncoveredAreaRatio = targetArea > 0 ? uncoveredArea / targetArea : 1;

  return {
    outsideAreaRatio,
    overlapAreaRatio,
    uncoveredAreaRatio,
    solved:
      outsideAreaRatio <= tolerance.outsideAreaRatio &&
      overlapAreaRatio <= tolerance.overlapAreaRatio &&
      uncoveredAreaRatio <= tolerance.uncoveredAreaRatio,
  };
}

function getPiecePolygon(piece: PieceState): Point[] {
  const vertices = piece.flipped
    ? piece.vertices.map((vertex) => ({ x: piece.width - vertex.x, y: vertex.y }))
    : piece.vertices;
  const angle = (piece.rotation * Math.PI) / 180;

  return vertices.map((vertex) => {
    const localX = vertex.x - piece.width / 2;
    const localY = vertex.y - piece.height / 2;
    return {
      x: piece.x + localX * Math.cos(angle) - localY * Math.sin(angle),
      y: piece.y + localX * Math.sin(angle) + localY * Math.cos(angle),
    };
  });
}

function getBounds(points: Point[]) {
  if (points.length === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  }

  return {
    minX: Math.min(...points.map((point) => point.x)),
    maxX: Math.max(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxY: Math.max(...points.map((point) => point.y)),
  };
}

function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    const intersects =
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (intersects) {
      inside = !inside;
    }
  }
  return inside;
}

export function getSolveIssues(
  pieces: PieceState[],
  targets: TargetPieceState[],
  tolerance: SolveTolerance,
): PieceSolveIssue[] {
  if (tolerance.allowAnyPieceOrder) {
    return matchAnyPieceOrder(pieces, targets, tolerance).issues;
  }

  return targets.map((target) => {
    const piece = pieces.find((item) => item.id === target.id);
    if (!piece) {
      return {
        pieceId: 'missing',
        targetId: target.id,
        positionDistance: Number.POSITIVE_INFINITY,
        angleDistance: Number.POSITIVE_INFINITY,
        flipOk: false,
      };
    }

    return createIssue(piece, target, tolerance);
  });
}

function createIssue(
  piece: PieceState,
  target: TargetPieceState,
  tolerance: SolveTolerance,
): PieceSolveIssue {
  return {
    pieceId: piece.id,
    targetId: target.id,
    positionDistance: positionDistance(piece, target),
    angleDistance: angleDistance(piece.rotation, target.rotation),
    flipOk: !tolerance.requireFlip || piece.flipped === target.flipped,
  };
}

function issuePasses(issue: PieceSolveIssue, tolerance: SolveTolerance): boolean {
  return (
    issue.positionDistance <= tolerance.position &&
    issue.angleDistance <= tolerance.angle &&
    issue.flipOk
  );
}

function matchAnyPieceOrder(
  pieces: PieceState[],
  targets: TargetPieceState[],
  tolerance: SolveTolerance,
): { solved: boolean; issues: PieceSolveIssue[] } {
  const usedPieceIds = new Set<string>();
  const issues: PieceSolveIssue[] = [];

  for (const target of targets) {
    const candidates = pieces
      .filter((piece) => !usedPieceIds.has(piece.id))
      .map((piece) => createIssue(piece, target, tolerance))
      .sort((a, b) => {
        const scoreA = a.positionDistance + a.angleDistance * 2;
        const scoreB = b.positionDistance + b.angleDistance * 2;
        return scoreA - scoreB;
      });

    const best = candidates[0];
    if (!best) {
      return { solved: false, issues };
    }

    usedPieceIds.add(best.pieceId);
    issues.push(best);
  }

  return {
    solved: issues.every((issue) => issuePasses(issue, tolerance)),
    issues,
  };
}

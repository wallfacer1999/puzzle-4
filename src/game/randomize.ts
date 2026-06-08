import type { LevelConfig, PieceState } from './types';

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function createScatteredPieces(level: LevelConfig): PieceState[] {
  const attempts = 80;
  let bestPieces: PieceState[] = [];
  let bestScore = Number.NEGATIVE_INFINITY;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const candidate = level.pieces.map((piece, index) => {
      const margin = Math.max(piece.width, piece.height) / 2 + 24;
      const band = index / Math.max(1, level.pieces.length - 1);
      const jitterX = randomInRange(-90, 90);
      const jitterY = randomInRange(-90, 90);
      const baseX = 95 + band * (level.boardWidth - 190);
      const baseY = index % 2 === 0 ? level.boardHeight * 0.34 : level.boardHeight * 0.68;

      return {
      ...piece,
      x: Math.min(level.boardWidth - margin, Math.max(margin, baseX + jitterX)),
      y: Math.min(level.boardHeight - margin, Math.max(margin, baseY + jitterY)),
      rotation: randomInRange(0, 360),
      flipped: Math.random() > 0.5,
      zIndex: index + 1,
      };
    });
    const score = scoreScatter(candidate);
    if (score > bestScore) {
      bestScore = score;
      bestPieces = candidate;
    }
  }

  return bestPieces;
}

function scoreScatter(pieces: PieceState[]): number {
  let minDistance = Number.POSITIVE_INFINITY;
  let overlapPenalty = 0;

  for (let i = 0; i < pieces.length; i += 1) {
    for (let j = i + 1; j < pieces.length; j += 1) {
      const a = pieces[i];
      const b = pieces[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      minDistance = Math.min(minDistance, distance);

      const minAllowed = (Math.max(a.width, a.height) + Math.max(b.width, b.height)) * 0.42;
      if (distance < minAllowed) {
        overlapPenalty += (minAllowed - distance) * 2;
      }
    }
  }

  return minDistance - overlapPenalty;
}

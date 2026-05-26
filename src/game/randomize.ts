import type { LevelConfig, PieceState } from './types';

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function createScatteredPieces(level: LevelConfig): PieceState[] {
  return level.pieces.map((piece, index) => {
    const margin = Math.max(piece.width, piece.height) / 2 + 20;

    return {
      ...piece,
      x: randomInRange(margin, level.boardWidth - margin),
      y: randomInRange(margin + 120, level.boardHeight - margin),
      rotation: randomInRange(0, 360),
      flipped: Math.random() > 0.5,
      zIndex: index + 1,
    };
  });
}

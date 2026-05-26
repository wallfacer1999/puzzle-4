import { tLevel } from '../src/game/levels';
import { createScatteredPieces } from '../src/game/randomize';
import { angleDistance, isSolved, normalizeAngle } from '../src/game/rules';
import type { PieceState } from '../src/game/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(normalizeAngle(-1) === 359, 'normalizes negative angles');
assert(normalizeAngle(725) === 5, 'normalizes large angles');
assert(angleDistance(359, 1) === 2, 'measures shortest angle distance');

const solvedPieces: PieceState[] = tLevel.targets.map((target, index) => ({
  ...tLevel.pieces[index],
  x: target.x,
  y: target.y,
  rotation: target.rotation,
  flipped: target.flipped,
  zIndex: index + 1,
}));

assert(isSolved(solvedPieces, tLevel.targets, tLevel.tolerance), 'solved layout passes');

const movedPieces = solvedPieces.map((piece) =>
  piece.id === 'piece-a' ? { ...piece, x: piece.x + 80 } : piece,
);
assert(!isSolved(movedPieces, tLevel.targets, tLevel.tolerance), 'moved piece fails');

const rotatedPieces = solvedPieces.map((piece) =>
  piece.id === 'piece-a' ? { ...piece, rotation: piece.rotation + 90 } : piece,
);
assert(!isSolved(rotatedPieces, tLevel.targets, tLevel.tolerance), 'rotated piece fails');

const flippedPieces = solvedPieces.map((piece) =>
  piece.id === 'piece-a' ? { ...piece, flipped: !piece.flipped } : piece,
);
assert(!isSolved(flippedPieces, tLevel.targets, tLevel.tolerance), 'bad coverage fails');

for (let run = 0; run < 20; run += 1) {
  const scattered = createScatteredPieces(tLevel);
  for (const piece of scattered) {
    const margin = Math.max(piece.width, piece.height) / 2 + 20;
    assert(piece.x >= margin, 'random x is inside left bound');
    assert(piece.x <= tLevel.boardWidth - margin, 'random x is inside right bound');
    assert(piece.y >= margin, 'random y is inside top bound');
    assert(piece.y <= tLevel.boardHeight - margin, 'random y is inside bottom bound');
  }
}

console.log('logic tests passed');

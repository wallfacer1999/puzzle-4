export type GameStatus = 'playing' | 'success' | 'failed';

export interface Point {
  x: number;
  y: number;
}

export interface BoardSize {
  width: number;
  height: number;
}

export interface PieceTemplate {
  id: string;
  width: number;
  height: number;
  color: string;
  polygon: string;
  vertices: Point[];
  actionCenter: Point;
}

export interface PieceState extends PieceTemplate {
  x: number;
  y: number;
  rotation: number;
  flipped: boolean;
  zIndex: number;
  flipHingeX?: number;
}

export interface TargetPieceState {
  id: string;
  x: number;
  y: number;
  rotation: number;
  flipped: boolean;
}

export interface SolveTolerance {
  position: number;
  angle: number;
  requireFlip: boolean;
  allowAnyPieceOrder: boolean;
  outsideAreaRatio: number;
  overlapAreaRatio: number;
  uncoveredAreaRatio: number;
  areaSampleStep: number;
}

export interface AreaSolveSummary {
  solved: boolean;
  outsideAreaRatio: number;
  overlapAreaRatio: number;
  uncoveredAreaRatio: number;
}

export interface PieceSolveIssue {
  pieceId: string;
  targetId: string;
  positionDistance: number;
  angleDistance: number;
  flipOk: boolean;
}

export interface LevelConfig {
  id: string;
  name: string;
  boardWidth: number;
  boardHeight: number;
  timeLimitSeconds: number;
  countdownEnabled: boolean;
  pieces: PieceTemplate[];
  targets: TargetPieceState[];
  tolerance: SolveTolerance;
}

export interface MovePayload {
  id: string;
  dx: number;
  dy: number;
}

export interface RotatePayload {
  id: string;
  deltaAngle: number;
}

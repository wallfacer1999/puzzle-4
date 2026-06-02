import type { Point } from '@/game/types';

export type GestureMode = 'tap' | 'drag' | 'rotate';
export const TAP_MAX_DURATION_MS = 220;
export const TAP_MAX_DISTANCE = 4;

export interface TouchLike {
  clientX?: number;
  clientY?: number;
  pageX?: number;
  pageY?: number;
}

export interface UniTouchEventLike {
  touches?: ArrayLike<TouchLike>;
  changedTouches?: ArrayLike<TouchLike>;
  clientX?: number;
  clientY?: number;
  pageX?: number;
  pageY?: number;
  stopPropagation?: () => void;
  preventDefault?: () => void;
}

export interface GestureStartOptions {
  mode: GestureMode;
  event: UniTouchEventLike;
  center: Point;
  scale: number;
}

export interface GestureState {
  mode: GestureMode;
  startPoint: Point;
  lastPoint: Point;
  center: Point;
  startAngle: number;
  lastAngle: number;
  startedAt: number;
  moved: boolean;
  receivedMove: boolean;
  scale: number;
}

function getTouchPoint(event: UniTouchEventLike): Point {
  const touch = event.touches?.[0] ?? event.changedTouches?.[0];
  return {
    x: touch?.clientX ?? touch?.pageX ?? event.clientX ?? event.pageX ?? 0,
    y: touch?.clientY ?? touch?.pageY ?? event.clientY ?? event.pageY ?? 0,
  };
}

function getAngle(point: Point, center: Point): number {
  return (Math.atan2(point.y - center.y, point.x - center.x) * 180) / Math.PI;
}

function distance(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function createGestureState(options: GestureStartOptions): GestureState {
  options.event.stopPropagation?.();
  options.event.preventDefault?.();

  const startPoint = getTouchPoint(options.event);
  const startAngle = getAngle(startPoint, options.center);

  return {
    mode: options.mode,
    startPoint,
    lastPoint: startPoint,
    center: options.center,
    startAngle,
    lastAngle: startAngle,
    startedAt: Date.now(),
    moved: false,
    receivedMove: false,
    scale: options.scale || 1,
  };
}

export function updateDragGesture(state: GestureState, event: UniTouchEventLike) {
  event.stopPropagation?.();
  event.preventDefault?.();

  const nextPoint = getTouchPoint(event);
  const dx = (nextPoint.x - state.lastPoint.x) / state.scale;
  const dy = (nextPoint.y - state.lastPoint.y) / state.scale;
  state.receivedMove = true;

  if (distance(nextPoint, state.startPoint) > 6) {
    state.moved = true;
  }

  state.lastPoint = nextPoint;
  return { dx, dy };
}

export function updateRotateGesture(state: GestureState, event: UniTouchEventLike) {
  event.stopPropagation?.();
  event.preventDefault?.();

  const nextPoint = getTouchPoint(event);
  const nextAngle = getAngle(nextPoint, state.center);
  let deltaAngle = nextAngle - state.lastAngle;
  state.receivedMove = true;

  if (deltaAngle > 180) {
    deltaAngle -= 360;
  } else if (deltaAngle < -180) {
    deltaAngle += 360;
  }

  if (distance(nextPoint, state.startPoint) > 6) {
    state.moved = true;
  }

  state.lastPoint = nextPoint;
  state.lastAngle = nextAngle;
  return { deltaAngle };
}

export function isTapGesture(state: GestureState, event: UniTouchEventLike): boolean {
  const endPoint = getTouchPoint(event);
  return (
    !state.receivedMove &&
    Date.now() - state.startedAt <= TAP_MAX_DURATION_MS &&
    distance(endPoint, state.startPoint) <= TAP_MAX_DISTANCE
  );
}

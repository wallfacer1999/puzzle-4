<template>
  <view class="board-shell">
    <view
      ref="boardRef"
      data-puzzle-board="true"
      class="board"
      :style="boardStyle"
      @mousedown.stop="startBoardGesture"
      @touchstart.stop="startBoardGesture"
      @mousemove.stop="moveBoardGesture"
      @touchmove.stop="moveBoardGesture"
      @mouseup.stop="endBoardGesture"
      @touchend.stop="endBoardGesture"
      @touchcancel.stop="cancelBoardGesture"
    >
      <view class="grid" />
      <template v-if="showTarget">
        <view
          v-for="target in targets"
          :key="target.id"
          class="target"
          :style="targetStyle(target)"
        />
      </template>
      <PuzzlePiece
        v-for="piece in pieces"
        :key="piece.id"
        :piece="piece"
        :scale="scale"
        :active="piece.id === activePieceId"
        :disabled="disabled"
        :animate-layout="animateLayout"
        :style="piece.id === guidePieceId && guideStep !== 'done' ? { zIndex: 10000 } : undefined"
        :show-controls="showControls && piece.id === guidePieceId"
        :guide-active="piece.id === guidePieceId && guideStep !== 'done'"
        :guide-step="guideStep"
        @activate="$emit('piece-activate', $event)"
        @move="(id, dx, dy) => $emit('piece-move', id, dx, dy)"
        @rotate="(id, deltaAngle) => $emit('piece-rotate', id, deltaAngle)"
        @flip="$emit('piece-flip', $event)"
      />
      <view v-if="showDebugHitArea" class="debug-layer">
        <view
          v-for="debugPiece in debugPieces"
          :key="debugPiece.id"
          class="debug-piece"
          :style="debugPiece.style"
        />
        <view
          v-for="handle in debugHandles"
          :key="handle.key"
          class="debug-handle"
          :style="handle.style"
        />
      </view>
      <view v-if="disabled" class="board-lock" />
      <view
        class="board-actions"
        @mousedown.stop
        @mousemove.stop
        @mouseup.stop
      >
        <view
          v-if="showSkipGuide"
          class="board-skip-control"
          hover-class="press-feedback"
          hover-start-time="0"
          hover-stay-time="120"
          @click.stop="handleSkipGuide"
          @mousedown.stop
          @touchstart.stop
          @touchend.stop="handleSkipGuide"
        >
          <text>跳过教程</text>
        </view>
        <view
          class="board-music-control"
          :class="{ playing: musicEnabled }"
          hover-class="press-feedback"
          hover-start-time="0"
          hover-stay-time="120"
          @click.stop="handleToggleMusic"
          @mousedown.stop
          @touchstart.stop
          @touchend.stop="handleToggleMusic"
        >
          <text class="music-note">🎵</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import PuzzlePiece from './PuzzlePiece.vue';
import { TAP_MAX_DISTANCE, TAP_MAX_DURATION_MS } from '@/composables/usePieceGesture';
import type { BoardSize, PieceState, Point, TargetPieceState } from '@/game/types';

const props = defineProps<{
  pieces: PieceState[];
  targets: TargetPieceState[];
  boardSize: BoardSize;
  activePieceId: string;
  disabled: boolean;
  animateLayout: boolean;
  musicEnabled: boolean;
  showTarget: boolean;
  showControls: boolean;
  showSkipGuide: boolean;
  guidePieceId: string;
  guideStep: 'drag' | 'flip' | 'rotate' | 'done';
}>();

const emit = defineEmits<{
  'piece-activate': [id: string];
  'piece-move': [id: string, dx: number, dy: number];
  'piece-rotate': [id: string, deltaAngle: number];
  'piece-flip': [id: string, hingeX?: number];
  'piece-gesture-end': [id?: string];
  'toggle-music': [];
  'skip-guide': [];
}>();

type TouchLike = {
  clientX?: number;
  clientY?: number;
  pageX?: number;
  pageY?: number;
};

type BoardEvent = MouseEvent | TouchEvent;
type GestureMode = 'drag' | 'rotate';

type BoardGesture = {
  id: string;
  mode: GestureMode;
  hingeX?: number;
  startPoint: Point;
  lastPoint: Point;
  center: Point;
  lastAngle: number;
  startedAt: number;
  moved: boolean;
  receivedMove: boolean;
};

type BoardRect = {
  left: number;
  top: number;
};

const systemInfo = ref(uni.getSystemInfoSync());
const boardRef = ref<HTMLElement | { $el?: HTMLElement } | null>(null);
const gesture = ref<BoardGesture | null>(null);
const boardRect = ref<BoardRect>({ left: 0, top: 0 });
let documentListenersActive = false;
const instance = getCurrentInstance();
const showDebugHitArea = false;
let lastControlActionAt = 0;

const scale = computed(() => {
  const usableWidth = Math.max(320, systemInfo.value.windowWidth - 28);
  const usableHeight = Math.max(520, systemInfo.value.windowHeight - 174);
  const widthScale = usableWidth / props.boardSize.width;
  const heightScale = usableHeight / props.boardSize.height;
  return Math.min(widthScale, heightScale);
});

const boardStyle = computed(() => ({
  width: `${props.boardSize.width * scale.value}px`,
  height: `${props.boardSize.height * scale.value}px`,
}));

const debugPieces = computed(() =>
  props.pieces.map((piece) => ({
    id: piece.id,
    style: {
      clipPath: toScreenClipPath(getScreenPolygon(piece)),
    },
  })),
);

const debugHandles = computed(() =>
  props.pieces.flatMap((piece) =>
    getDisplayVertices(piece).map((vertex, index) => {
      const point = transformVertex(piece, vertex);
      return {
        key: `${piece.id}-${index}`,
        style: {
          left: `${point.x}px`,
          top: `${point.y}px`,
        },
      };
    }),
  ),
);

function targetStyle(target: TargetPieceState) {
  const template = props.pieces.find((piece) => piece.id === target.id);
  if (!template) {
    return {};
  }

  const width = template.width * scale.value;
  const height = template.height * scale.value;
  const x = target.x * scale.value;
  const y = target.y * scale.value;

  return {
    width: `${width}px`,
    height: `${height}px`,
    clipPath: `polygon(${template.polygon})`,
    transform: `translate(${x - width / 2}px, ${y - height / 2}px) rotate(${target.rotation}deg)`,
  };
}

function getEventPoint(event: BoardEvent): Point {
  const touchEvent = event as TouchEvent;
  const mouseEvent = event as MouseEvent;
  const touch = touchEvent.touches?.[0] ?? touchEvent.changedTouches?.[0];
  return {
    x: touch?.clientX ?? touch?.pageX ?? mouseEvent.clientX ?? mouseEvent.pageX ?? 0,
    y: touch?.clientY ?? touch?.pageY ?? mouseEvent.clientY ?? mouseEvent.pageY ?? 0,
  };
}

function getBoardPoint(event: BoardEvent): Point {
  const point = getEventPoint(event);
  return {
    x: point.x - boardRect.value.left,
    y: point.y - boardRect.value.top,
  };
}

function getBoardElement(): HTMLElement | null {
  const refValue = boardRef.value;
  if (refValue && 'getBoundingClientRect' in refValue) {
    return refValue;
  }
  if (refValue && '$el' in refValue && refValue.$el) {
    return refValue.$el;
  }
  if (typeof document !== 'undefined') {
    return document.querySelector('[data-puzzle-board="true"]');
  }
  return null;
}

function syncBoardRectByDom(): boolean {
  const element = getBoardElement();
  const rect = element?.getBoundingClientRect?.();
  if (!rect) {
    return false;
  }

  boardRect.value = {
    left: rect.left,
    top: rect.top,
  };
  return true;
}

function syncBoardRectBySelector(): Promise<void> {
  return new Promise((resolve) => {
    const query = uni.createSelectorQuery().in(instance?.proxy);
    query
      .select('.board')
      .boundingClientRect((rect) => {
        if (!Array.isArray(rect) && rect) {
          boardRect.value = {
            left: rect.left ?? 0,
            top: rect.top ?? 0,
          };
        }
        resolve();
      })
      .exec();
  });
}

async function syncBoardRect() {
  if (syncBoardRectByDom()) {
    return;
  }
  await syncBoardRectBySelector();
}

function getAngle(point: Point, center: Point): number {
  return (Math.atan2(point.y - center.y, point.x - center.x) * 180) / Math.PI;
}

function distance(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function normalizeDeltaAngle(delta: number): number {
  if (delta > 180) {
    return delta - 360;
  }
  if (delta < -180) {
    return delta + 360;
  }
  return delta;
}

function getDisplayVertices(piece: PieceState): Point[] {
  if (!piece.flipped) {
    return piece.vertices;
  }

  return piece.vertices.map((vertex) => ({
    x: piece.width - vertex.x,
    y: vertex.y,
  }));
}

function transformVertex(piece: PieceState, vertex: Point): Point {
  const scaleValue = scale.value;
  const center = {
    x: piece.x * scaleValue,
    y: piece.y * scaleValue,
  };
  const local = {
    x: (vertex.x - piece.width / 2) * scaleValue,
    y: (vertex.y - piece.height / 2) * scaleValue,
  };
  const angle = (piece.rotation * Math.PI) / 180;
  return {
    x: center.x + local.x * Math.cos(angle) - local.y * Math.sin(angle),
    y: center.y + local.x * Math.sin(angle) + local.y * Math.cos(angle),
  };
}

function getScreenPolygon(piece: PieceState): Point[] {
  return getDisplayVertices(piece).map((vertex) => transformVertex(piece, vertex));
}

function toScreenClipPath(points: Point[]): string {
  return `polygon(${points.map((point) => `${point.x}px ${point.y}px`).join(', ')})`;
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

function sortedPieces() {
  return [...props.pieces].sort((a, b) => {
    const guideA = a.id === props.guidePieceId && props.guideStep !== 'done' ? 10000 : 0;
    const guideB = b.id === props.guidePieceId && props.guideStep !== 'done' ? 10000 : 0;
    return b.zIndex + guideB - (a.zIndex + guideA);
  });
}

function hitTest(point: Point): { piece: PieceState; mode: GestureMode } | null {
  const rotateRadius = 24;

  for (const piece of sortedPieces()) {
    const vertices = getDisplayVertices(piece).map((vertex) => transformVertex(piece, vertex));
    if (vertices.some((vertex) => distance(point, vertex) <= rotateRadius)) {
      return { piece, mode: 'rotate' };
    }
  }

  for (const piece of sortedPieces()) {
    if (pointInPolygon(point, getScreenPolygon(piece))) {
      return { piece, mode: 'drag' };
    }
  }

  return null;
}

function getLocalHingeX(piece: PieceState, point: Point): number {
  const scaleValue = scale.value;
  const center = {
    x: piece.x * scaleValue,
    y: piece.y * scaleValue,
  };
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const angle = (-piece.rotation * Math.PI) / 180;
  const localX = dx * Math.cos(angle) - dy * Math.sin(angle) + (piece.width * scaleValue) / 2;
  const normalizedX = localX / scaleValue;
  return Math.max(0, Math.min(piece.width, normalizedX));
}

async function startBoardGesture(event: BoardEvent) {
  if (props.disabled) {
    return;
  }

  event.preventDefault?.();
  await syncBoardRect();
  const point = getBoardPoint(event);
  const hit = hitTest(point);
  if (!hit) {
    return;
  }

  const center = {
    x: hit.piece.x * scale.value,
    y: hit.piece.y * scale.value,
  };

  emit('piece-activate', hit.piece.id);
  gesture.value = {
    id: hit.piece.id,
    mode: hit.mode,
    hingeX: hit.mode === 'drag' ? getLocalHingeX(hit.piece, point) : undefined,
    startPoint: point,
    lastPoint: point,
    center,
    lastAngle: getAngle(point, center),
    startedAt: Date.now(),
    moved: false,
    receivedMove: false,
  };

  if (isMouseEvent(event)) {
    bindDocumentMouseListeners();
  }
}

function moveBoardGesture(event: BoardEvent) {
  if (!gesture.value) {
    return;
  }
  event.preventDefault?.();
  const point = getBoardPoint(event);
  const activeGesture = gesture.value;
  activeGesture.receivedMove = true;

  if (distance(point, activeGesture.startPoint) > 6) {
    activeGesture.moved = true;
  }

  if (activeGesture.mode === 'drag') {
    emit(
      'piece-move',
      activeGesture.id,
      (point.x - activeGesture.lastPoint.x) / scale.value,
      (point.y - activeGesture.lastPoint.y) / scale.value,
    );
  } else {
    const angle = getAngle(point, activeGesture.center);
    emit('piece-rotate', activeGesture.id, normalizeDeltaAngle(angle - activeGesture.lastAngle));
    activeGesture.lastAngle = angle;
  }

  activeGesture.lastPoint = point;
}

function endBoardGesture(event?: BoardEvent) {
  const activeGesture = gesture.value;
  if (!activeGesture) {
    return;
  }
  if (event) {
    event.preventDefault?.();
  }
  const endPoint = event ? getBoardPoint(event) : activeGesture.lastPoint;
  const isTap =
    !activeGesture.receivedMove &&
    Date.now() - activeGesture.startedAt <= TAP_MAX_DURATION_MS &&
    distance(endPoint, activeGesture.startPoint) <= TAP_MAX_DISTANCE;
  if (activeGesture.mode === 'drag' && isTap) {
    emit('piece-flip', activeGesture.id, activeGesture.hingeX);
  }
  gesture.value = null;
  unbindDocumentMouseListeners();
  emit('piece-gesture-end', activeGesture.id);
}

function cancelBoardGesture() {
  const activeGesture = gesture.value;
  gesture.value = null;
  unbindDocumentMouseListeners();
  if (activeGesture) {
    emit('piece-gesture-end', activeGesture.id);
  }
}

function isMouseEvent(event: BoardEvent): event is MouseEvent {
  return 'button' in event;
}

function bindDocumentMouseListeners() {
  if (documentListenersActive || typeof document === 'undefined') {
    return;
  }
  documentListenersActive = true;
  document.addEventListener('mousemove', moveBoardGesture);
  document.addEventListener('mouseup', endBoardGesture);
}

function unbindDocumentMouseListeners() {
  if (!documentListenersActive || typeof document === 'undefined') {
    return;
  }
  documentListenersActive = false;
  document.removeEventListener('mousemove', moveBoardGesture);
  document.removeEventListener('mouseup', endBoardGesture);
}

function runControlAction(action: () => void) {
  const now = Date.now();
  if (now - lastControlActionAt < 500) {
    return;
  }
  lastControlActionAt = now;
  action();
}

function handleSkipGuide() {
  runControlAction(() => emit('skip-guide'));
}

function handleToggleMusic() {
  runControlAction(() => emit('toggle-music'));
}

onBeforeUnmount(() => {
  unbindDocumentMouseListeners();
});

onMounted(async () => {
  await nextTick();
  await syncBoardRect();
});
</script>

<style scoped>
.board-shell {
  display: flex;
  justify-content: center;
  width: 100%;
  min-height: 0;
  padding: 12px 0 14px;
}

.board {
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(70, 78, 94, 0.18);
  border-radius: 10px;
  background: #3f4648;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.16), 0 18px 32px rgba(55, 62, 78, 0.18);
  touch-action: none;
}

.grid {
  position: absolute;
  inset: 0;
  opacity: 0.55;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.48) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.48) 1px, transparent 1px);
  background-size: 42px 42px;
}

.target {
  position: absolute;
  left: 0;
  top: 0;
  background: rgba(255, 255, 255, 0.16);
  pointer-events: none;
  transform-origin: center;
}

.debug-layer {
  position: absolute;
  inset: 0;
  z-index: 9000;
  pointer-events: none;
}

.debug-piece {
  position: absolute;
  inset: 0;
  background: rgba(41, 151, 255, 0.2);
  outline: 1px solid rgba(41, 151, 255, 0.95);
}

.debug-handle {
  position: absolute;
  width: 36px;
  height: 36px;
  border: 2px solid rgba(50, 235, 132, 0.95);
  border-radius: 50%;
  background: rgba(50, 235, 132, 0.24);
  transform: translate(-50%, -50%);
}

.board-lock {
  position: absolute;
  inset: 0;
  z-index: 9999;
}

.board-actions {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 10040;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.board-skip-control,
.board-music-control {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  padding: 0;
  border: 2px solid rgba(255, 255, 255, 0.86);
  background: rgba(255, 253, 248, 0.88);
  color: #7b8798;
  line-height: 1;
  box-sizing: border-box;
  transform: translateZ(0);
}

.board-skip-control {
  min-width: 94px;
  padding: 0 12px;
  border-radius: 999px;
  color: #263143;
  font-size: 16px;
  font-weight: 900;
}

.board-music-control {
  width: 36px;
  border-radius: 50%;
}

.board-music-control.playing {
  color: #263143;
  background: #ffe45c;
}

.music-note {
  font-size: 20px;
  font-weight: 900;
  line-height: 1;
}

.board-music-control.playing .music-note {
  animation: music-spin 8s linear infinite;
}

@keyframes music-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

</style>

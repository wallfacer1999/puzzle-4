<template>
  <view
    class="piece"
    :class="{ active, flipped: piece.flipped, 'position-animate': flipAnimating, 'layout-animate': animateLayout }"
    :style="pieceStyle"
    @mousemove.stop="moveActiveGesture"
    @mouseup.stop="endActiveGesture"
    @touchmove.stop="moveActiveGesture"
    @touchend.stop="endActiveGesture"
    @touchcancel.stop="endGesture"
  >
    <view class="guide-layer" :class="guideClass">
      <view class="flip-layer" :style="layerStyle">
        <view v-if="showOutline" class="piece-outline" :style="surfaceHandleStyle" />
        <view
          class="piece-face"
          :style="faceStyle"
        >
          <image
            v-if="piece.textureUrl"
            class="piece-texture"
            :src="piece.textureUrl"
            mode="aspectFill"
          />
          <view class="shine" />
        </view>
        <view
          class="surface-handle"
          :style="surfaceHandleStyle"
          @click.stop="flipFromTap"
          @mousedown.stop="startDrag"
          @mousemove.stop="moveDrag"
          @mouseup.stop="endActiveGesture"
          @touchstart.stop="startDrag"
          @touchmove.stop="moveDrag"
          @touchend.stop="endActiveGesture"
          @touchcancel.stop="endGesture"
        />
        <view
          class="drag-handle"
          :class="{ visible: showDragHandle }"
          :style="dragHandleStyle"
          @click.stop="flipFromTap"
          @mousedown.stop="startDrag"
          @mousemove.stop="moveDrag"
          @mouseup.stop="endActiveGesture"
          @touchstart.stop="startDrag"
          @touchmove.stop="moveDrag"
          @touchend.stop="endActiveGesture"
          @touchcancel.stop="endGesture"
        />
        <view
          v-for="(handle, index) in rotateHandles"
          :key="index"
          class="rotate-handle"
          :class="{ visible: handle.visible }"
          :style="handle.style"
          @click.stop
          @mousedown.stop="startRotate"
          @mousemove.stop="moveRotate"
          @mouseup.stop="endGesture"
          @touchstart.stop="startRotate"
          @touchmove.stop="moveRotate"
          @touchend.stop="endGesture"
          @touchcancel.stop="endGesture"
        />
      </view>
      <image
        v-if="showGuideHand"
        class="guide-hand"
        :style="guideHandStyle"
        src="/static/icons/tutorial-hand.png"
        mode="aspectFit"
      />
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import {
  TAP_MAX_DURATION_MS,
  createGestureState,
  isTapGesture,
  updateDragGesture,
  updateRotateGesture,
  type GestureState,
  type UniTouchEventLike,
} from '@/composables/usePieceGesture';
import type { PieceState } from '@/game/types';

const props = defineProps<{
  piece: PieceState;
  scale: number;
  active: boolean;
  disabled: boolean;
  animateLayout: boolean;
  showControls: boolean;
  guideActive: boolean;
  guideStep: 'drag' | 'flip' | 'rotate' | 'done';
}>();

const emit = defineEmits<{
  activate: [id: string];
  move: [id: string, dx: number, dy: number];
  rotate: [id: string, deltaAngle: number];
  flip: [id: string];
}>();

const gesture = ref<GestureState | null>(null);
const flipAnimating = ref(false);
let suppressTapUntil = 0;
let documentListenersActive = false;
let flipTimer: ReturnType<typeof setTimeout> | undefined;
let lastPointerStartedAt = 0;
let lastPointerMoved = false;

const pieceStyle = computed(() => {
  const width = props.piece.width * props.scale;
  const height = props.piece.height * props.scale;
  const x = props.piece.x * props.scale;
  const y = props.piece.y * props.scale;

  return {
    width: `${width}px`,
    height: `${height}px`,
    zIndex: props.guideActive && props.guideStep !== 'done' ? 10000 : props.piece.zIndex,
    transform: `translate(${x - width / 2}px, ${y - height / 2}px) rotate(${props.piece.rotation}deg)`,
  };
});

const layerStyle = computed(() => {
  const originX = (props.piece.flipHingeX ?? props.piece.width / 2) * props.scale;
  const originY = props.piece.height * props.scale * 0.5;

  return {
    transformOrigin: `${originX}px ${originY}px`,
  };
});

const guideClass = computed(() => ({
  'guide-drag': props.showControls && props.guideActive && props.guideStep === 'drag',
  'guide-flip': props.showControls && props.guideActive && props.guideStep === 'flip',
  'guide-rotate': props.showControls && props.guideActive && props.guideStep === 'rotate',
  'flip-animate': flipAnimating.value,
}));

const faceStyle = computed(() => ({
  backgroundColor: props.piece.color,
  clipPath: `polygon(${showOutline.value ? innerDisplayPolygon.value : displayPolygon.value})`,
  '--piece-texture': props.piece.texture ? '1' : '0',
}));

const surfaceHandleStyle = computed(() => ({
  clipPath: `polygon(${displayPolygon.value})`,
}));

const dragHandleStyle = computed(() => ({
  left: `${displayActionCenter.value.x * props.scale}px`,
  top: `${displayActionCenter.value.y * props.scale}px`,
}));

const guideHandStyle = computed(() => {
  const anchor = guideHandAnchor.value;
  return {
    left: `${anchor.x}px`,
    top: `${anchor.y}px`,
    '--guide-flip-x': `${guideFlipOffsetX.value}px`,
  };
});

const rotateHandles = computed(() =>
  displayVertices.value.map((vertex, index) => ({
    style: {
      left: `${vertex.x * props.scale}px`,
      top: `${vertex.y * props.scale}px`,
    },
    visible: showRotateHandles.value && index === 0,
  })),
);

const guideHandAnchor = computed(() => {
  if (props.guideStep === 'rotate') {
    const vertex = displayVertices.value[0] ?? props.piece.actionCenter;
    return {
      x: vertex.x * props.scale,
      y: vertex.y * props.scale,
    };
  }
  return {
    x: displayActionCenter.value.x * props.scale,
    y: displayActionCenter.value.y * props.scale,
  };
});

const displayActionCenter = computed(() => {
  if (!props.piece.flipped) {
    return props.piece.actionCenter;
  }
  return {
    x: props.piece.width - props.piece.actionCenter.x,
    y: props.piece.actionCenter.y,
  };
});

const guideFlipOffsetX = computed(() => (
  (props.piece.width - props.piece.actionCenter.x * 2) * props.scale
));

const displayVertices = computed(() => {
  if (!props.piece.flipped) {
    return props.piece.vertices;
  }
  return props.piece.vertices.map((vertex) => ({
    x: props.piece.width - vertex.x,
    y: vertex.y,
  }));
});

const displayPolygon = computed(() =>
  polygonToCss(displayVertices.value),
);

const innerDisplayPolygon = computed(() =>
  polygonToCss(shrinkVertices(displayVertices.value, 4 / props.scale)),
);

const showOutline = computed(() => !props.piece.texture);

function polygonToCss(vertices: { x: number; y: number }[]) {
  return vertices
    .map((vertex) => {
      const x = (vertex.x / props.piece.width) * 100;
      const y = (vertex.y / props.piece.height) * 100;
      return `${Number(x.toFixed(4))}% ${Number(y.toFixed(4))}%`;
    })
    .join(', ');
}

function shrinkVertices(vertices: { x: number; y: number }[], amount: number) {
  const center = vertices.reduce(
    (acc, vertex) => ({
      x: acc.x + vertex.x / vertices.length,
      y: acc.y + vertex.y / vertices.length,
    }),
    { x: 0, y: 0 },
  );

  return vertices.map((vertex) => {
    const dx = center.x - vertex.x;
    const dy = center.y - vertex.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length <= amount || length === 0) {
      return vertex;
    }
    return {
      x: vertex.x + (dx / length) * amount,
      y: vertex.y + (dy / length) * amount,
    };
  });
}

const showDragHandle = computed(
  () => props.showControls && props.guideActive && (props.guideStep === 'drag' || props.guideStep === 'flip'),
);

const showRotateHandles = computed(
  () => props.showControls && props.guideActive && props.guideStep === 'rotate',
);

const showGuideHand = computed(
  () => props.showControls && props.guideActive && props.guideStep !== 'done',
);

function visualCenter() {
  return {
    x: props.piece.x * props.scale,
    y: props.piece.y * props.scale,
  };
}

function startGesture(mode: 'tap' | 'drag' | 'rotate', event: MouseEvent | TouchEvent) {
  if (props.disabled) {
    return;
  }
  event.preventDefault?.();
  emit('activate', props.piece.id);
  lastPointerStartedAt = Date.now();
  lastPointerMoved = false;
  gesture.value = createGestureState({
    mode,
    event: event as UniTouchEventLike,
    center: visualCenter(),
    scale: props.scale,
  });

  if (isMouseEvent(event)) {
    bindDocumentMouseListeners();
  }
}

function flipFromTap() {
  if (props.disabled || Date.now() < suppressTapUntil) {
    return;
  }
  if (lastPointerStartedAt && (lastPointerMoved || Date.now() - lastPointerStartedAt > TAP_MAX_DURATION_MS)) {
    return;
  }
  emit('activate', props.piece.id);
  emit('flip', props.piece.id);
}

function startDrag(event: MouseEvent | TouchEvent) {
  startGesture('drag', event);
}

function moveDrag(event: MouseEvent | TouchEvent) {
  if (!gesture.value || gesture.value.mode !== 'drag') {
    return;
  }
  const { dx, dy } = updateDragGesture(gesture.value, event as UniTouchEventLike);
  lastPointerMoved = true;
  emit('move', props.piece.id, dx, dy);
}

function startRotate(event: MouseEvent | TouchEvent) {
  startGesture('rotate', event);
}

function moveRotate(event: MouseEvent | TouchEvent) {
  if (!gesture.value || gesture.value.mode !== 'rotate') {
    return;
  }
  const { deltaAngle } = updateRotateGesture(gesture.value, event as UniTouchEventLike);
  lastPointerMoved = true;
  emit('rotate', props.piece.id, deltaAngle);
}

function moveActiveGesture(event: MouseEvent | TouchEvent) {
  if (!gesture.value) {
    return;
  }
  if (gesture.value.mode === 'drag') {
    moveDrag(event);
  } else if (gesture.value.mode === 'rotate') {
    moveRotate(event);
  }
}

function endActiveGesture(event: MouseEvent | TouchEvent) {
  const shouldFlip =
    gesture.value?.mode === 'drag' &&
    isTapGesture(gesture.value, event as UniTouchEventLike);
  endGesture();
  if (shouldFlip) {
    emit('activate', props.piece.id);
    emit('flip', props.piece.id);
    suppressTapUntil = Date.now() + 320;
  }
}

function endGesture() {
  if (gesture.value?.moved) {
    suppressTapUntil = Date.now() + 320;
  }
  gesture.value = null;
  unbindDocumentMouseListeners();
}

function isMouseEvent(event: MouseEvent | TouchEvent): event is MouseEvent {
  return 'button' in event;
}

function bindDocumentMouseListeners() {
  if (documentListenersActive || typeof document === 'undefined') {
    return;
  }
  documentListenersActive = true;
  document.addEventListener('mousemove', handleDocumentMouseMove);
  document.addEventListener('mouseup', handleDocumentMouseUp);
}

function unbindDocumentMouseListeners() {
  if (!documentListenersActive || typeof document === 'undefined') {
    return;
  }
  documentListenersActive = false;
  document.removeEventListener('mousemove', handleDocumentMouseMove);
  document.removeEventListener('mouseup', handleDocumentMouseUp);
}

function handleDocumentMouseMove(event: MouseEvent) {
  moveActiveGesture(event);
}

function handleDocumentMouseUp(event: MouseEvent) {
  endActiveGesture(event);
}

onBeforeUnmount(() => {
  unbindDocumentMouseListeners();
  if (flipTimer) {
    clearTimeout(flipTimer);
  }
});

watch(
  () => props.piece.flipped,
  () => {
    flipAnimating.value = true;
    if (flipTimer) {
      clearTimeout(flipTimer);
    }
    flipTimer = setTimeout(() => {
      flipAnimating.value = false;
    }, 280);
  },
);
</script>

<style scoped>
.piece {
  position: absolute;
  left: 0;
  top: 0;
  border-radius: 8px;
  transform-origin: 50% 50%;
  touch-action: none;
  user-select: none;
  pointer-events: none;
}

.piece.position-animate {
  transition: transform 0.28s ease-out;
}

.piece.layout-animate {
  transition: transform 0.62s cubic-bezier(0.18, 0.88, 0.28, 1.14);
}

.guide-layer,
.flip-layer {
  position: absolute;
  inset: 0;
}

.guide-layer {
  pointer-events: none;
}

.flip-layer {
  transition:
    transform 0.16s ease-out,
    filter 0.16s ease-out;
}

.piece-face {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.piece-texture {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.piece.active .piece-face {
  filter: brightness(1.04);
}

.piece.active .flip-layer {
  transform: translateY(-4px);
  filter: drop-shadow(0 10px 10px rgba(29, 36, 51, 0.2));
}

.piece-outline {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.96);
}

.shine {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(120deg, rgba(255, 255, 255, 0.18), transparent 42%),
    repeating-linear-gradient(45deg, rgba(255, 255, 255, calc(0.1 * var(--piece-texture))) 0 2px, transparent 2px 10px);
}

.surface-handle {
  position: absolute;
  inset: 0;
  background: transparent;
}

.drag-handle {
  position: absolute;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: transparent;
  transform: translate(-50%, -50%);
}

.drag-handle.visible {
  border: 3px solid rgba(255, 255, 255, 0.86);
  background: rgba(20, 27, 41, 0.15);
}

.rotate-handle {
  position: absolute;
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  background-clip: padding-box;
  transform: translate(-50%, -50%);
}

.rotate-handle.visible {
  border: 3px solid rgba(255, 255, 255, 0.88);
  background: rgba(29, 36, 51, 0.22);
}

.guide-layer.guide-drag {
  animation: guide-drag 1.6s ease-in-out infinite;
}

.guide-layer.guide-flip .flip-layer {
  animation: guide-flip 3.2s ease-in-out infinite;
}

.guide-layer.flip-animate .flip-layer {
  animation: flip-pop 0.28s ease-out;
}

.guide-layer.guide-rotate {
  animation: guide-rotate 1.6s ease-in-out infinite;
}

.guide-hand {
  position: absolute;
  z-index: 30;
  width: 50px;
  height: 50px;
  pointer-events: none;
  transform: translate(-43%, -14%);
  transform-origin: 50% 18%;
}

.guide-layer.guide-drag .guide-hand {
  opacity: 0.96;
}

.guide-layer.guide-flip .guide-hand {
  animation: guide-hand-flip 3.2s ease-in-out infinite;
}

.guide-layer.guide-flip .drag-handle.visible {
  animation: guide-flip-control 3.2s ease-in-out infinite;
}

.guide-layer.guide-rotate .guide-hand {
  opacity: 0.96;
}

@keyframes guide-drag {
  0%,
  100% {
    transform: translate(0, 0);
  }
  50% {
    transform: translate(54px, 26px);
  }
}

@keyframes guide-flip {
  0%,
  28%,
  36% {
    transform: scaleX(1);
  }
  48%,
  86% {
    transform: scaleX(-1);
  }
  96%,
  100% {
    transform: scaleX(1);
  }
}

@keyframes guide-hand-flip {
  0%,
  14% {
    opacity: 0.96;
    transform: translate(-43%, -14%) scale(1);
  }
  22% {
    opacity: 1;
    transform: translate(-43%, -14%) scale(0.82);
  }
  28% {
    opacity: 0.96;
    transform: translate(-43%, -14%) scale(1);
  }
  32%,
  68% {
    opacity: 0;
    transform: translate(-43%, -14%) scale(1);
  }
  70% {
    opacity: 0.96;
    transform: translate(calc(-43% + var(--guide-flip-x)), -14%) scale(1);
  }
  78% {
    opacity: 1;
    transform: translate(calc(-43% + var(--guide-flip-x)), -14%) scale(0.82);
  }
  84% {
    opacity: 0.96;
    transform: translate(calc(-43% + var(--guide-flip-x)), -14%) scale(1);
  }
  86%,
  100% {
    opacity: 0;
    transform: translate(calc(-43% + var(--guide-flip-x)), -14%) scale(1);
  }
}

@keyframes guide-flip-control {
  0%,
  14% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  22% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(0.82);
  }
  28% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  32%,
  68% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(1);
  }
  70% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  78% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(0.82);
  }
  84% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  86%,
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(1);
  }
}

@keyframes flip-pop {
  0% {
    transform: rotateY(0deg) scale(1);
    filter: brightness(1);
  }
  50% {
    transform: rotateY(88deg) scale(0.98);
    filter: brightness(1.18);
  }
  100% {
    transform: rotateY(0deg) scale(1);
    filter: brightness(1);
  }
}

@keyframes guide-rotate {
  0%,
  100% {
    transform: rotate(0deg);
  }
  50% {
    transform: rotate(26deg);
  }
}

</style>

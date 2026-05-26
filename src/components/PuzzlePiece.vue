<template>
  <view
    class="piece"
    :class="{ active, flipped: piece.flipped, 'position-animate': flipAnimating }"
    :style="pieceStyle"
    @mousemove.stop="moveActiveGesture"
    @mouseup.stop="endActiveGesture"
    @touchmove.stop="moveActiveGesture"
    @touchend.stop="endActiveGesture"
    @touchcancel.stop="endGesture"
  >
    <view class="guide-layer" :class="guideClass">
      <view class="flip-layer" :style="layerStyle">
        <view
          class="piece-face"
          :style="faceStyle"
        >
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
          :class="{ visible: showRotateHandles }"
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
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import {
  createGestureState,
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

const pieceStyle = computed(() => {
  const width = props.piece.width * props.scale;
  const height = props.piece.height * props.scale;
  const x = props.piece.x * props.scale;
  const y = props.piece.y * props.scale;

  return {
    width: `${width}px`,
    height: `${height}px`,
    zIndex: props.piece.zIndex,
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
  'guide-drag': props.guideActive && props.guideStep === 'drag',
  'guide-flip': props.guideActive && props.guideStep === 'flip',
  'guide-rotate': props.guideActive && props.guideStep === 'rotate',
  'flip-animate': flipAnimating.value,
}));

const faceStyle = computed(() => ({
  backgroundColor: props.piece.color,
  clipPath: `polygon(${displayPolygon.value})`,
}));

const surfaceHandleStyle = computed(() => ({
  clipPath: `polygon(${displayPolygon.value})`,
}));

const dragHandleStyle = computed(() => ({
  left: `${props.piece.actionCenter.x * props.scale}px`,
  top: `${props.piece.actionCenter.y * props.scale}px`,
}));

const rotateHandles = computed(() =>
  displayVertices.value.map((vertex) => ({
    style: {
      left: `${vertex.x * props.scale}px`,
      top: `${vertex.y * props.scale}px`,
    },
  })),
);

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
  displayVertices.value
    .map((vertex) => {
      const x = (vertex.x / props.piece.width) * 100;
      const y = (vertex.y / props.piece.height) * 100;
      return `${Number(x.toFixed(4))}% ${Number(y.toFixed(4))}%`;
    })
    .join(', '),
);

const showDragHandle = computed(
  () => props.showControls && props.guideActive && (props.guideStep === 'drag' || props.guideStep === 'flip'),
);

const showRotateHandles = computed(
  () => props.showControls && props.guideActive && props.guideStep === 'rotate',
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

function endActiveGesture() {
  const shouldFlip = gesture.value?.mode === 'drag' && !gesture.value.moved;
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

function handleDocumentMouseUp() {
  endActiveGesture();
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

.guide-layer,
.flip-layer {
  position: absolute;
  inset: 0;
}

.piece-face {
  position: absolute;
  inset: 0;
  overflow: hidden;
  box-shadow: 0 12px 22px rgba(44, 55, 79, 0.22);
}

.piece.active .piece-face {
  filter: brightness(1.05);
}

.shine {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(120deg, rgba(255, 255, 255, 0.22), transparent 42%),
    repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.1) 0 2px, transparent 2px 10px);
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
  animation: guide-drag 1.8s ease-in-out infinite;
}

.guide-layer.guide-flip .flip-layer {
  animation: guide-flip 1.6s ease-in-out infinite;
}

.guide-layer.flip-animate .flip-layer {
  animation: flip-pop 0.28s ease-out;
}

.guide-layer.guide-rotate {
  animation: guide-rotate 1.8s ease-in-out infinite;
}

@keyframes guide-drag {
  0%,
  100% {
    transform: translate(0, 0);
  }
  45% {
    transform: translate(54px, 26px);
  }
}

@keyframes guide-flip {
  0%,
  100% {
    transform: scaleX(1);
  }
  50% {
    transform: scaleX(-1);
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
  45% {
    transform: rotate(26deg);
  }
}
</style>

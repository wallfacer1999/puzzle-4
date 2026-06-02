<template>
  <view class="page" :style="pageStyle">
    <view class="header" :style="headerStyle">
      <view class="brand">
        <text class="logo">T</text>
        <text class="title">字拼图</text>
      </view>
      <text v-if="level.difficulty === 'easy'" class="mode-badge">简单版</text>
    </view>

    <GameToolbar
      class="toolbar"
      :remaining-seconds="remainingSeconds"
      :status="status"
      :countdown-enabled="level.countdownEnabled"
    />

    <view class="play-area">
      <PuzzleBoard
        :pieces="pieces"
        :targets="level.targets"
        :show-target="level.showTarget"
        :board-size="{ width: level.boardWidth, height: level.boardHeight }"
        :active-piece-id="activePieceId"
        :disabled="phase !== 'playing' || status !== 'playing' || resultModalVisible"
        :animate-layout="boardAnimating"
        :music-enabled="musicEnabled"
        :show-controls="phase === 'guide' && guideMode === 'demo' && guideStep !== 'done'"
        :show-skip-guide="phase === 'guide' && guideStep !== 'done'"
        :guide-piece-id="guidePieceId"
        :guide-step="guideStep"
        @piece-activate="activatePiece"
        @piece-move="movePiece"
        @piece-rotate="rotatePiece"
        @piece-flip="(id, hingeX) => flipPiece(id, hingeX)"
        @piece-gesture-end="checkAfterPieceOperation"
        @toggle-music="toggleMusic"
        @skip-guide="skipGuide"
      />
      <view v-if="toastMessage" class="toast">
        <text>{{ toastMessage }}</text>
      </view>
      <view v-if="showDebugMetrics && phase === 'playing'" class="debug-metrics">
        <text>遮挡 {{ debugMetrics.overlap }} / {{ debugMetrics.overlapLimit }}%</text>
        <text>覆盖 {{ debugMetrics.coverage }}%</text>
        <text>超出 {{ debugMetrics.outside }} / {{ debugMetrics.outsideLimit }}%</text>
        <text>空缺 {{ debugMetrics.uncovered }} / {{ debugMetrics.uncoveredLimit }}%</text>
        <text>偏差 {{ debugMetrics.mismatch }} / {{ debugMetrics.mismatchLimit }}%</text>
      </view>
      <view v-if="phase === 'preview'" class="start-panel">
        <text class="start-title">准备挑战</text>
        <text class="start-copy">打散后开始计时，拼回刚才的 T 字</text>
        <view class="tips">
          <view class="tip-row">
            <image class="tip-icon-image" src="/static/icons/tutorial-move.png" mode="aspectFit" />
            <text>按住木块拖动</text>
          </view>
          <view class="tip-row">
            <image class="tip-icon-image" src="/static/icons/tutorial-rotate.png" mode="aspectFit" />
            <text>按住任意角旋转</text>
          </view>
          <view class="tip-row">
            <image class="tip-icon-image" src="/static/icons/tutorial-flip.png" mode="aspectFit" />
            <text>轻点木块翻面</text>
          </view>
        </view>
        <button
          class="start-button"
          hover-class="press-feedback"
          hover-start-time="0"
          hover-stay-time="120"
          @click="startGameWithMusic"
        >
          开始挑战
        </button>
        <view class="secondary-actions">
          <button
            class="secondary-button"
            hover-class="press-feedback"
            hover-start-time="0"
            hover-stay-time="120"
            @click="replayGuide"
          >
            重看教学
          </button>
          <button
            class="secondary-button"
            hover-class="press-feedback"
            hover-start-time="0"
            hover-stay-time="120"
            @click="startGameMuted"
          >
            静音开始
          </button>
        </view>
      </view>
      <view v-if="phase === 'guide' && guideMode === 'hint' && guideStep !== 'done'" class="operation-hint">
        <image class="hint-icon-image" :src="guideIconSrc" mode="aspectFit" />
        <text>{{ guideText }}</text>
      </view>
    </view>

    <ResultModal
      :visible="resultModalVisible"
      :status="status"
      :elapsed-seconds="elapsedSeconds"
      :can-lower-difficulty="level.difficulty !== 'easy'"
      @restart="restartGame"
      @lower-difficulty="lowerDifficulty"
      @share="shareGame"
    />
  </view>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { onShareAppMessage } from '@dcloudio/uni-app';
import GameToolbar from '@/components/GameToolbar.vue';
import PuzzleBoard from '@/components/PuzzleBoard.vue';
import ResultModal from '@/components/ResultModal.vue';
import { usePuzzleGame } from '@/composables/usePuzzleGame';
import { easyLevel, normalLevel } from '@/game/levels';
import { getAreaSolveSummary } from '@/game/rules';

const level = ref(normalLevel);
const phase = ref<'preview' | 'guide' | 'scattering' | 'playing'>('guide');
const guideStep = ref<'drag' | 'flip' | 'rotate' | 'done'>('drag');
const guideMode = ref<'hint' | 'demo'>('hint');
const boardAnimating = ref(false);
const musicEnabled = ref(false);
const debugMetrics = ref({
  overlap: '0.0',
  overlapLimit: '0.0',
  coverage: '0.0',
  outside: '0.0',
  outsideLimit: '0.0',
  uncovered: '0.0',
  uncoveredLimit: '0.0',
  mismatch: '0.0',
  mismatchLimit: '0.0',
});
const systemInfo = uni.getSystemInfoSync();
const safeTop = systemInfo.safeAreaInsets?.top ?? 28;
const menuButton = typeof uni.getMenuButtonBoundingClientRect === 'function'
  ? uni.getMenuButtonBoundingClientRect()
  : undefined;
const navTop = menuButton?.top ?? safeTop + 8;
const navHeight = menuButton?.height ?? 40;
let hintTimers: ReturnType<typeof setTimeout>[] = [];
let boardAnimationTimer: ReturnType<typeof setTimeout> | undefined;
let bgm: UniApp.InnerAudioContext | undefined;
let successSound: UniApp.InnerAudioContext | undefined;
let failSound: UniApp.InnerAudioContext | undefined;
let bgmMode: 'normal' | 'fast' = 'normal';
const urgentSeconds = 20;

const {
  pieces,
  status,
  remainingSeconds,
  elapsedSeconds,
  activePieceId,
  resultModalVisible,
  toastMessage,
  showToast,
  showSolvedPreview,
  startGame,
  beginCountdown,
  switchLevel,
  activatePiece,
  deactivatePiece,
  movePiece,
  rotatePiece,
  snapPieceRotation,
  flipPiece,
  checkSolved,
} = usePuzzleGame(level);

const showDebugMetrics = false;
const guidePieceId = computed(() => pieces.value.find((piece) => piece.id === 'piece-b')?.id ?? '');

const pageStyle = computed(() => ({
  paddingTop: `${navTop}px`,
}));

const headerStyle = computed(() => ({
  height: `${navHeight}px`,
}));

const guideText = computed(() => {
  if (guideStep.value === 'drag') {
    return '按住木块，拖到想放的位置';
  }
  if (guideStep.value === 'flip') {
    return '轻点木块，可以翻到另一面';
  }
  if (guideStep.value === 'rotate') {
    return '按住任意角旋转';
  }
  return '';
});

const guideIconSrc = computed(() => {
  if (guideStep.value === 'drag') {
    return '/static/icons/tutorial-move.png';
  }
  if (guideStep.value === 'flip') {
    return '/static/icons/tutorial-flip.png';
  }
  if (guideStep.value === 'rotate') {
    return '/static/icons/tutorial-rotate.png';
  }
  return '';
});

function playGuideThenShowStart() {
  phase.value = 'guide';
  guideStep.value = 'drag';
  guideMode.value = 'hint';
  clearGuideTimers();
  hintTimers = [
    setTimeout(() => {
      guideMode.value = 'demo';
    }, 1400),
    setTimeout(() => {
      guideStep.value = 'rotate';
      guideMode.value = 'hint';
    }, 4600),
    setTimeout(() => {
      guideMode.value = 'demo';
    }, 6000),
    setTimeout(() => {
      guideStep.value = 'flip';
      guideMode.value = 'hint';
    }, 9200),
    setTimeout(() => {
      guideMode.value = 'demo';
    }, 10600),
    setTimeout(() => {
      guideStep.value = 'done';
      phase.value = 'preview';
    }, 13800),
  ];
}

function scatterAndStartGame() {
  clearGuideTimers();
  guideStep.value = 'done';
  guideMode.value = 'demo';
  phase.value = 'scattering';
  boardAnimating.value = true;
  startGame({ startTimers: false });
  if (boardAnimationTimer) {
    clearTimeout(boardAnimationTimer);
  }
  boardAnimationTimer = setTimeout(() => {
    boardAnimating.value = false;
    phase.value = 'playing';
    updateDebugMetrics();
    beginCountdown();
  }, 680);
}

function skipGuide() {
  clearGuideTimers();
  guideStep.value = 'done';
  guideMode.value = 'hint';
  phase.value = 'preview';
}

function updateDebugMetrics() {
  const summary = getAreaSolveSummary(pieces.value, level.value.targets, level.value.tolerance);
  const tolerance = level.value.tolerance;
  debugMetrics.value = {
    overlap: (summary.overlapAreaRatio * 100).toFixed(1),
    overlapLimit: (tolerance.overlapAreaRatio * 100).toFixed(1),
    coverage: ((1 - summary.targetMismatchRatio) * 100).toFixed(1),
    outside: (summary.outsideAreaRatio * 100).toFixed(1),
    outsideLimit: (tolerance.outsideAreaRatio * 100).toFixed(1),
    uncovered: (summary.uncoveredAreaRatio * 100).toFixed(1),
    uncoveredLimit: (tolerance.uncoveredAreaRatio * 100).toFixed(1),
    mismatch: (summary.targetMismatchRatio * 100).toFixed(1),
    mismatchLimit: (tolerance.targetMismatchRatio * 100).toFixed(1),
  };
  return summary;
}

function checkAfterPieceOperation(pieceId?: string) {
  if (pieceId) {
    snapPieceRotation(pieceId);
  }
  if (phase.value !== 'playing' || status.value !== 'playing') {
    deactivatePiece();
    return;
  }
  updateDebugMetrics();
  checkSolved({ silent: true });
  deactivatePiece();
}

function clearGuideTimers() {
  hintTimers.forEach((timer) => clearTimeout(timer));
  hintTimers = [];
}

function restartGame() {
  clearGuideTimers();
  if (boardAnimationTimer) {
    clearTimeout(boardAnimationTimer);
    boardAnimationTimer = undefined;
  }
  boardAnimating.value = false;
  phase.value = 'guide';
  showSolvedPreview();
  playGuideThenShowStart();
}

function startGameWithMusic() {
  musicEnabled.value = true;
  showSolvedPreview();
  playBgm();
  scatterAndStartGame();
}

function startGameMuted() {
  musicEnabled.value = false;
  stopBgm();
  showSolvedPreview();
  scatterAndStartGame();
}

function replayGuide() {
  showSolvedPreview();
  playGuideThenShowStart();
}

function lowerDifficulty() {
  switchLevel(easyLevel);
  phase.value = 'guide';
  playGuideThenShowStart();
}

function shareGame() {
  showToast('点击右上角菜单分享给朋友试试');
}

function toggleMusic() {
  musicEnabled.value = !musicEnabled.value;
  if (musicEnabled.value) {
    playBgm();
  } else {
    stopBgm();
  }
}

function ensureBgm() {
  if (bgm) {
    return bgm;
  }
  bgm = uni.createInnerAudioContext();
  bgm.loop = true;
  bgm.volume = 0.46;
  setBgmMode(remainingSeconds.value <= urgentSeconds ? 'fast' : 'normal');
  return bgm;
}

function setBgmMode(mode: 'normal' | 'fast') {
  const sound = ensureBgm();
  if (bgmMode === mode && sound.src) {
    return;
  }
  const wasPlaying = musicEnabled.value && phase.value === 'playing';
  bgmMode = mode;
  sound.stop();
  sound.src = mode === 'fast' ? '/static/audio/bgm-fast.mp3' : '/static/audio/bgm.mp3';
  if (wasPlaying) {
    sound.play();
  }
}

function createSound(src: string, volume: number) {
  const sound = uni.createInnerAudioContext();
  sound.src = src;
  sound.volume = volume;
  return sound;
}

function ensureSuccessSound() {
  successSound ??= createSound('/static/audio/success.mp3', 0.5);
  return successSound;
}

function ensureFailSound() {
  failSound ??= createSound('/static/audio/fail.mp3', 0.44);
  return failSound;
}

function playOneShot(sound: UniApp.InnerAudioContext) {
  sound.stop();
  sound.seek(0);
  sound.play();
}

function playBgm() {
  if (!musicEnabled.value) {
    return;
  }
  setBgmMode(phase.value === 'playing' && remainingSeconds.value <= urgentSeconds ? 'fast' : 'normal');
  ensureBgm().play();
}

function stopBgm() {
  bgm?.pause();
}

onShareAppMessage(() => ({
  title: 'T字拼图，来试试你能不能拼出来',
  path: '/pages/game/index',
}));

onMounted(() => {
  playGuideThenShowStart();
});

watch(status, (nextStatus) => {
  if (nextStatus === 'success' || nextStatus === 'failed') {
    const shouldPlayResultSound = musicEnabled.value;
    musicEnabled.value = false;
    stopBgm();
    if (shouldPlayResultSound) {
      playOneShot(nextStatus === 'success' ? ensureSuccessSound() : ensureFailSound());
    }
  }
});

watch(remainingSeconds, (seconds) => {
  if (phase.value === 'playing' && musicEnabled.value) {
    setBgmMode(seconds > 0 && seconds <= urgentSeconds ? 'fast' : 'normal');
  }
});

onBeforeUnmount(() => {
  clearGuideTimers();
  if (boardAnimationTimer) {
    clearTimeout(boardAnimationTimer);
  }
  bgm?.destroy();
  successSound?.destroy();
  failSound?.destroy();
});
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  padding-right: 20px;
  padding-bottom: calc(14px + env(safe-area-inset-bottom));
  padding-left: 20px;
  overflow: hidden;
  background:
    radial-gradient(circle at 18% 12%, rgba(255, 229, 89, 0.36), transparent 22%),
    radial-gradient(circle at 88% 8%, rgba(92, 187, 255, 0.32), transparent 24%),
    linear-gradient(135deg, #fff5cf 0%, #f4d58d 44%, #a8d6cf 100%);
}

.header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
  flex-shrink: 0;
  margin-bottom: 8px;
  padding: 0 4px;
}

.brand {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 6px;
}

.logo {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  border-radius: 9px;
  background: #263143;
  color: #ffe45c;
  font-size: 21px;
  font-weight: 900;
  line-height: 1;
}

.title {
  display: block;
  font-size: 24px;
  font-weight: 900;
  line-height: 1.15;
  color: #1d2433;
}

.mode-badge {
  flex-shrink: 0;
  font-size: 16px;
  line-height: 1.3;
  padding: 4px 9px;
  border: 2px solid #263143;
  border-radius: 999px;
  background: #ffe45c;
  color: #263143;
  font-weight: 900;
}

.toolbar {
  flex-shrink: 0;
}

.play-area {
  position: relative;
  display: flex;
  justify-content: center;
  min-height: 0;
  flex: 1;
}

.start-panel {
  position: absolute;
  left: 50%;
  top: 50%;
  z-index: 12000;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: min(520px, 84%);
  padding: 18px 18px 20px;
  border: 3px solid #263143;
  border-radius: 16px;
  background: linear-gradient(180deg, #fff8dd 0%, #ffe8a6 100%);
  box-shadow: 7px 7px 0 rgba(38, 49, 67, 0.18);
  transform: translate(-50%, -50%);
  animation: panel-pop 0.24s cubic-bezier(0.18, 0.9, 0.28, 1.16);
}

.start-title {
  font-size: 28px;
  font-weight: 900;
  line-height: 1.2;
  color: #263143;
}

.start-copy {
  margin-top: 6px;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.35;
  color: #66572c;
  text-align: center;
}

.tips {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  margin-top: 14px;
}

.tip-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 38px;
  padding: 8px 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.46);
  color: #263143;
  font-size: 19px;
  font-weight: 800;
  line-height: 1.25;
}

.tip-icon-image {
  display: block;
  width: 34px;
  height: 34px;
  flex-shrink: 0;
}

.start-button {
  width: 100%;
  height: 58px;
  margin: 16px 0 0;
  border: 0;
  border-radius: 14px;
  background: #1f6feb;
  color: #fff;
  font-size: 24px;
  font-weight: 900;
  line-height: 58px;
}

.secondary-actions {
  display: flex;
  gap: 10px;
  width: 100%;
  margin-top: 10px;
}

.secondary-button {
  flex: 1;
  height: 48px;
  margin: 0;
  border: 0;
  border-radius: 14px;
  background: rgba(38, 49, 67, 0.12);
  color: #263143;
  font-size: 21px;
  font-weight: 900;
  line-height: 48px;
}

.start-button::after,
.secondary-button::after {
  border: 0;
}

.toast {
  position: absolute;
  left: 50%;
  bottom: 28px;
  z-index: 8000;
  max-width: 82%;
  padding: 14px 22px;
  border-radius: 999px;
  background: rgba(30, 38, 53, 0.9);
  color: #fff;
  font-size: 22px;
  font-weight: 700;
  line-height: 1.25;
  transform: translateX(-50%);
}

.debug-metrics {
  position: absolute;
  left: 16px;
  bottom: 18px;
  z-index: 8500;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(29, 36, 51, 0.78);
  color: #fff8dd;
  font-size: 16px;
  font-weight: 800;
  line-height: 1.25;
}

.operation-hint {
  position: fixed;
  left: 50%;
  top: 50%;
  z-index: 13000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 7px;
  width: min(360px, 86%);
  max-width: 86%;
  padding: 14px 18px 16px;
  border: 2px solid rgba(38, 49, 67, 0.9);
  border-radius: 18px;
  background: linear-gradient(135deg, rgba(38, 49, 67, 0.94), rgba(63, 75, 103, 0.94));
  box-shadow: 5px 5px 0 rgba(255, 228, 92, 0.45);
  color: #fff8dd;
  font-size: 20px;
  font-weight: 800;
  line-height: 1.25;
  text-align: center;
  white-space: nowrap;
  transform: translate(-50%, -50%);
  animation: hint-pop 0.22s ease-out;
}

.hint-icon-image {
  display: block;
  width: 46px;
  height: 46px;
  flex-shrink: 0;
}

@keyframes panel-pop {
  0% {
    opacity: 0;
    transform: translate(-50%, -48%) scale(0.94);
  }
  100% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}

@keyframes hint-pop {
  0% {
    opacity: 0;
    transform: translate(-50%, -46%) scale(0.92);
  }
  100% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}

@media (max-width: 520px) {
  .page {
    padding-right: 12px;
    padding-bottom: calc(10px + env(safe-area-inset-bottom));
    padding-left: 12px;
  }

  .header {
    gap: 8px;
    margin-bottom: 7px;
    padding: 0 2px;
  }

  .logo {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    font-size: 20px;
  }

  .title {
    font-size: 22px;
  }

  .mode-badge {
    font-size: 15px;
    padding: 3px 8px;
  }

  .start-panel {
    width: 88%;
    padding: 14px;
  }

  .start-title {
    font-size: 21px;
  }

  .start-copy {
    font-size: 16px;
  }

  .tip-row {
    min-height: 34px;
    font-size: 17px;
  }

  .start-button {
    height: 52px;
    font-size: 22px;
    line-height: 52px;
  }

  .secondary-button {
    height: 44px;
    font-size: 19px;
    line-height: 44px;
  }
}
</style>

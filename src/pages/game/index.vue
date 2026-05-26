<template>
  <view class="page">
    <view class="header">
      <text class="title">{{ level.name }}</text>
      <text class="subtitle">四块板拼成 T 字</text>
    </view>

    <GameToolbar
      class="toolbar"
      :remaining-seconds="remainingSeconds"
      :status="status"
      :countdown-enabled="level.countdownEnabled"
      @check="checkSolved"
      @restart="restartGame"
    />

    <view class="play-area">
      <PuzzleBoard
        :pieces="pieces"
        :targets="level.targets"
        :board-size="{ width: level.boardWidth, height: level.boardHeight }"
        :active-piece-id="activePieceId"
        :disabled="status !== 'playing' || resultModalVisible"
        :show-controls="guideStep !== 'done'"
        :guide-piece-id="guidePieceId"
        :guide-step="guideStep"
        @piece-activate="activatePiece"
        @piece-move="movePiece"
        @piece-rotate="rotatePiece"
        @piece-flip="(id, hingeX) => flipPiece(id, hingeX)"
      />
      <view v-if="toastMessage" class="toast">
        <text>{{ toastMessage }}</text>
      </view>
      <view v-if="guideStep !== 'done'" class="operation-hint">
        <text>{{ guideText }}</text>
      </view>
    </view>

    <ResultModal
      :visible="resultModalVisible"
      :status="status"
      :elapsed-seconds="elapsedSeconds"
      @restart="restartGame"
    />
  </view>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import GameToolbar from '@/components/GameToolbar.vue';
import PuzzleBoard from '@/components/PuzzleBoard.vue';
import ResultModal from '@/components/ResultModal.vue';
import { usePuzzleGame } from '@/composables/usePuzzleGame';
import { tLevel } from '@/game/levels';

const level = tLevel;
const guideStep = ref<'drag' | 'flip' | 'rotate' | 'done'>('drag');
let hintTimers: ReturnType<typeof setTimeout>[] = [];

const {
  pieces,
  status,
  remainingSeconds,
  elapsedSeconds,
  activePieceId,
  resultModalVisible,
  toastMessage,
  restart,
  checkSolved,
  activatePiece,
  movePiece,
  rotatePiece,
  flipPiece,
} = usePuzzleGame(level);

const guidePieceId = computed(() => {
  const topPiece = [...pieces.value].sort((a, b) => a.y - b.y)[0];
  return topPiece?.id ?? '';
});

const guideText = computed(() => {
  if (guideStep.value === 'drag') {
    return '按住木块中心拖动，可移动木块';
  }
  if (guideStep.value === 'flip') {
    return '点击木块中心，可像真实木块一样翻面';
  }
  if (guideStep.value === 'rotate') {
    return '按住木块顶点拖动，可旋转角度';
  }
  return '';
});

function showStartupHint() {
  guideStep.value = 'drag';
  clearGuideTimers();
  hintTimers = [
    setTimeout(() => {
    guideStep.value = 'flip';
    }, 2400),
    setTimeout(() => {
    guideStep.value = 'rotate';
    }, 4800),
    setTimeout(() => {
    guideStep.value = 'done';
    }, 7200),
  ];
}

function clearGuideTimers() {
  hintTimers.forEach((timer) => clearTimeout(timer));
  hintTimers = [];
}

function restartGame() {
  restart();
  showStartupHint();
}

onMounted(() => {
  showStartupHint();
});

onBeforeUnmount(() => {
  clearGuideTimers();
});
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  padding: 26px 24px 18px;
  overflow: hidden;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.72), rgba(244, 241, 234, 0.74)),
    #f4f1ea;
}

.header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 18px;
}

.title {
  font-size: 34px;
  font-weight: 900;
  line-height: 1.15;
  color: #1d2433;
}

.subtitle {
  flex-shrink: 0;
  font-size: 22px;
  line-height: 1.3;
  color: #667085;
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

.operation-hint {
  position: absolute;
  left: 50%;
  top: 18px;
  z-index: 8000;
  max-width: 86%;
  padding: 12px 18px;
  border-radius: 999px;
  background: rgba(255, 253, 248, 0.94);
  box-shadow: 0 8px 24px rgba(20, 28, 40, 0.18);
  color: #243047;
  font-size: 20px;
  font-weight: 800;
  line-height: 1.25;
  text-align: center;
  transform: translateX(-50%);
}

@media (max-width: 520px) {
  .page {
    padding: 18px 14px 12px;
  }

  .header {
    align-items: flex-start;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 12px;
  }

  .title {
    font-size: 28px;
  }

  .subtitle {
    font-size: 18px;
  }
}
</style>

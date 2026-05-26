import { computed, onBeforeUnmount, ref } from 'vue';
import { createScatteredPieces } from '@/game/randomize';
import { getAreaSolveSummary, isSolved, normalizeAngle } from '@/game/rules';
import type { GameStatus, LevelConfig, PieceState } from '@/game/types';

export function usePuzzleGame(level: LevelConfig) {
  const pieces = ref<PieceState[]>([]);
  const status = ref<GameStatus>('playing');
  const remainingSeconds = ref(level.timeLimitSeconds);
  const activePieceId = ref('');
  const resultModalVisible = ref(false);
  const toastMessage = ref('');
  let timer: ReturnType<typeof setInterval> | undefined;
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  let zCounter = 10;

  const elapsedSeconds = computed(() => level.timeLimitSeconds - remainingSeconds.value);

  function stopTimer() {
    if (timer) {
      clearInterval(timer);
      timer = undefined;
    }
  }

  function showToast(message: string) {
    toastMessage.value = message;
    if (toastTimer) {
      clearTimeout(toastTimer);
    }
    toastTimer = setTimeout(() => {
      toastMessage.value = '';
    }, 1300);
  }

  function failByTimeout() {
    if (status.value !== 'playing') {
      return;
    }
    stopTimer();
    status.value = 'failed';
    resultModalVisible.value = true;
    activePieceId.value = '';
  }

  function startTimer() {
    stopTimer();
    if (!level.countdownEnabled) {
      return;
    }
    timer = setInterval(() => {
      if (remainingSeconds.value <= 1) {
        remainingSeconds.value = 0;
        failByTimeout();
        return;
      }
      remainingSeconds.value -= 1;
    }, 1000);
  }

  function startGame() {
    pieces.value = createScatteredPieces(level);
    status.value = 'playing';
    remainingSeconds.value = level.timeLimitSeconds;
    activePieceId.value = '';
    resultModalVisible.value = false;
    toastMessage.value = '';
    zCounter = level.pieces.length + 10;
    startTimer();
  }

  function restart() {
    stopTimer();
    startGame();
  }

  function activatePiece(id: string) {
    if (status.value !== 'playing') {
      return;
    }
    activePieceId.value = id;
    pieces.value = pieces.value.map((piece) =>
      piece.id === id ? { ...piece, zIndex: zCounter++ } : piece,
    );
  }

  function updatePiece(id: string, updater: (piece: PieceState) => PieceState) {
    if (status.value !== 'playing') {
      return;
    }
    pieces.value = pieces.value.map((piece) => (piece.id === id ? updater(piece) : piece));
  }

  function movePiece(id: string, dx: number, dy: number) {
    updatePiece(id, (piece) => ({
      ...piece,
      x: Math.min(level.boardWidth, Math.max(0, piece.x + dx)),
      y: Math.min(level.boardHeight, Math.max(0, piece.y + dy)),
    }));
  }

  function rotatePiece(id: string, deltaAngle: number) {
    updatePiece(id, (piece) => ({
      ...piece,
      rotation: normalizeAngle(piece.rotation + deltaAngle),
    }));
  }

  function flipPiece(id: string, hingeX?: number) {
    updatePiece(id, (piece) => ({
      ...piece,
      flipped: !piece.flipped,
      flipHingeX: hingeX,
    }));
  }

  function checkSolved() {
    if (status.value !== 'playing') {
      return;
    }
    if (isSolved(pieces.value, level.targets, level.tolerance)) {
      stopTimer();
      status.value = 'success';
      resultModalVisible.value = true;
      activePieceId.value = '';
      return;
    }
    const summary = getAreaSolveSummary(pieces.value, level.targets, level.tolerance);
    if (summary.outsideAreaRatio > level.tolerance.outsideAreaRatio) {
      showToast(`有木块超出 T 区域 ${Math.round(summary.outsideAreaRatio * 100)}%`);
      return;
    }
    if (summary.overlapAreaRatio > level.tolerance.overlapAreaRatio) {
      showToast(`木块重叠 ${Math.round(summary.overlapAreaRatio * 100)}%`);
      return;
    }
    if (summary.uncoveredAreaRatio > level.tolerance.uncoveredAreaRatio) {
      showToast(`T 区域还有空缺 ${Math.round(summary.uncoveredAreaRatio * 100)}%`);
      return;
    }
    showToast('还没对齐，再试试');
  }

  onBeforeUnmount(() => {
    stopTimer();
    if (toastTimer) {
      clearTimeout(toastTimer);
    }
  });

  startGame();

  return {
    pieces,
    status,
    remainingSeconds,
    elapsedSeconds,
    activePieceId,
    resultModalVisible,
    toastMessage,
    startGame,
    restart,
    stopTimer,
    checkSolved,
    failByTimeout,
    activatePiece,
    movePiece,
    rotatePiece,
    flipPiece,
  };
}

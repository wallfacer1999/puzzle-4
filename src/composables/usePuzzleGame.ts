import { computed, onBeforeUnmount, ref, unref, type Ref } from 'vue';
import { createScatteredPieces } from '@/game/randomize';
import { getAreaSolveSummary, isSolved, normalizeAngle } from '@/game/rules';
import type { GameStatus, LevelConfig, PieceState } from '@/game/types';

export function usePuzzleGame(levelInput: LevelConfig | Ref<LevelConfig>) {
  const level = computed(() => unref(levelInput));
  const pieces = ref<PieceState[]>([]);
  const status = ref<GameStatus>('playing');
  const remainingSeconds = ref(level.value.timeLimitSeconds);
  const activePieceId = ref('');
  const resultModalVisible = ref(false);
  const toastMessage = ref('');
  let timer: ReturnType<typeof setInterval> | undefined;
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  let zCounter = 10;

  const elapsedSeconds = computed(() => level.value.timeLimitSeconds - remainingSeconds.value);

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
    if (isSolved(pieces.value, level.value.targets, level.value.tolerance)) {
      stopTimer();
      status.value = 'success';
      resultModalVisible.value = true;
      activePieceId.value = '';
      return;
    }
    stopTimer();
    status.value = 'failed';
    resultModalVisible.value = true;
    activePieceId.value = '';
  }

  function startTimer() {
    stopTimer();
    if (!level.value.countdownEnabled) {
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

  function createSolvedPreviewPieces(): PieceState[] {
    return level.value.targets.map((target, index) => {
      const template = level.value.pieces.find((piece) => piece.id === target.id);
      if (!template) {
        return undefined;
      }
      return {
        ...template,
        x: target.x,
        y: target.y,
        rotation: target.rotation,
        flipped: target.flipped,
        zIndex: index + 1,
      };
    }).filter((piece): piece is PieceState => Boolean(piece));
  }

  function resetRoundState(nextPieces: PieceState[]) {
    stopTimer();
    pieces.value = nextPieces;
    status.value = 'playing';
    remainingSeconds.value = level.value.timeLimitSeconds;
    activePieceId.value = '';
    resultModalVisible.value = false;
    toastMessage.value = '';
    zCounter = level.value.pieces.length + 10;
  }

  function showSolvedPreview() {
    resetRoundState(createSolvedPreviewPieces());
  }

  function startGame(options: { startTimers?: boolean } = {}) {
    resetRoundState(createScatteredPieces(level.value));
    if (options.startTimers === false) {
      return;
    }
    startTimer();
  }

  function beginCountdown() {
    if (status.value !== 'playing') {
      return;
    }
    startTimer();
  }

  function restart() {
    startGame();
  }

  function switchLevel(nextLevel: LevelConfig) {
    if ('value' in Object(levelInput)) {
      (levelInput as Ref<LevelConfig>).value = nextLevel;
    }
    showSolvedPreview();
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

  function deactivatePiece() {
    activePieceId.value = '';
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
      x: Math.min(level.value.boardWidth, Math.max(0, piece.x + dx)),
      y: Math.min(level.value.boardHeight, Math.max(0, piece.y + dy)),
    }));
  }

  function rotatePiece(id: string, deltaAngle: number) {
    updatePiece(id, (piece) => ({
      ...piece,
      rotation: normalizeAngle(piece.rotation + deltaAngle),
    }));
  }

  function snapPieceRotation(id: string, threshold = 5) {
    updatePiece(id, (piece) => {
      const snappedRotation = snapAxisAngle(piece.rotation, threshold);
      if (snappedRotation === piece.rotation) {
        return piece;
      }
      return {
        ...piece,
        rotation: snappedRotation,
      };
    });
  }

  function snapAxisAngle(rotation: number, threshold: number) {
    const normalized = normalizeAngle(rotation);
    const candidates = [0, 90, 180, 270, 360];
    const closest = candidates.reduce((best, candidate) => {
      const distance = Math.abs(normalized - candidate);
      return distance < best.distance ? { angle: candidate, distance } : best;
    }, { angle: normalized, distance: Number.POSITIVE_INFINITY });

    if (closest.distance > threshold) {
      return normalized;
    }

    return normalizeAngle(closest.angle);
  }

  function flipPiece(id: string, hingeX?: number) {
    updatePiece(id, (piece) => ({
      ...piece,
      flipped: !piece.flipped,
      flipHingeX: hingeX,
    }));
  }

  function checkSolved(options: { silent?: boolean } = {}) {
    if (status.value !== 'playing') {
      return;
    }
    if (isSolved(pieces.value, level.value.targets, level.value.tolerance)) {
      stopTimer();
      status.value = 'success';
      resultModalVisible.value = true;
      activePieceId.value = '';
      return;
    }
    if (options.silent) {
      return;
    }
    const summary = getAreaSolveSummary(pieces.value, level.value.targets, level.value.tolerance);
    if (summary.overlapAreaRatio > level.value.tolerance.overlapAreaRatio) {
      showToast(`木块重叠 ${Math.round(summary.overlapAreaRatio * 100)}%`);
      return;
    }
    if (summary.targetMismatchRatio > level.value.tolerance.targetMismatchRatio) {
      showToast(`离 T 字还差 ${Math.round(summary.targetMismatchRatio * 100)}%`);
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

  showSolvedPreview();

  return {
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
    restart,
    switchLevel,
    stopTimer,
    checkSolved,
    failByTimeout,
    activatePiece,
    deactivatePiece,
    movePiece,
    rotatePiece,
    snapPieceRotation,
    flipPiece,
  };
}

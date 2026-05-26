<template>
  <view class="toolbar">
    <view class="time-pill" :class="{ urgent: remainingSeconds <= 10 && status === 'playing' }">
      <text class="time-label">{{ countdownEnabled ? '倒计时' : '测试模式' }}</text>
      <text class="time-value">{{ countdownEnabled ? remainingSecondsText : '不限时' }}</text>
    </view>
    <view class="actions">
      <button class="button secondary" hover-class="button-hover" @tap="$emit('restart')">
        重来
      </button>
      <button
        class="button primary"
        hover-class="button-hover"
        :disabled="status !== 'playing'"
        @tap="$emit('check')"
      >
        判定
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { GameStatus } from '@/game/types';

const props = defineProps<{
  remainingSeconds: number;
  status: GameStatus;
  countdownEnabled: boolean;
}>();

defineEmits<{
  restart: [];
  check: [];
}>();

const remainingSecondsText = computed(() => {
  const minutes = Math.floor(props.remainingSeconds / 60);
  const seconds = props.remainingSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
});
</script>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
}

.time-pill {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 136px;
  height: 64px;
  padding: 0 18px;
  border: 1px solid rgba(37, 47, 67, 0.12);
  border-radius: 8px;
  background: #fffdf8;
}

.time-pill.urgent {
  border-color: rgba(203, 49, 60, 0.42);
  background: #fff4f0;
  color: #b52d35;
}

.time-label {
  font-size: 20px;
  line-height: 1.2;
  color: #667085;
}

.time-value {
  margin-top: 2px;
  font-size: 30px;
  font-weight: 800;
  line-height: 1;
  color: #1d2433;
}

.actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 112px;
  height: 58px;
  margin: 0;
  padding: 0 20px;
  border: 0;
  border-radius: 8px;
  font-size: 24px;
  font-weight: 800;
  line-height: 58px;
}

.button::after {
  border: 0;
}

.button.primary {
  background: #1f6feb;
  color: #fff;
}

.button.secondary {
  background: #2f3947;
  color: #fff;
}

.button[disabled] {
  opacity: 0.55;
}

.button-hover {
  opacity: 0.86;
}
</style>

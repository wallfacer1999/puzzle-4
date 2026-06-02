<template>
  <view class="toolbar">
    <view class="time-pill" :class="{ urgent: remainingSeconds <= 20 && status === 'playing' }">
      <text class="time-icon">⏱</text>
      <text class="time-value">{{ countdownEnabled ? remainingSecondsText : '不限时' }}</text>
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

const remainingSecondsText = computed(() => {
  return String(props.remainingSeconds);
});
</script>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.time-pill {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 112px;
  height: 48px;
  padding: 0 14px;
  border: 2px solid #263143;
  border-radius: 999px;
  background: rgba(255, 253, 248, 0.92);
  box-shadow: 4px 4px 0 rgba(38, 49, 67, 0.14);
}

.time-pill.urgent {
  border-color: rgba(203, 49, 60, 0.42);
  background: #fff4f0;
  color: #b52d35;
}

.time-icon {
  font-size: 22px;
  line-height: 1;
}

.time-value {
  font-size: 28px;
  font-weight: 800;
  line-height: 1;
  color: #1d2433;
}
</style>

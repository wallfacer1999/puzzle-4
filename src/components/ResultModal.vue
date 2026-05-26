<template>
  <view v-if="visible" class="modal-mask">
    <view class="modal">
      <text class="title">{{ status === 'success' ? '拼对了' : '时间到' }}</text>
      <text class="message">
        {{ status === 'success' ? `用时 ${elapsedSeconds} 秒，挑战完成` : '挑战失败，再来一局' }}
      </text>
      <button class="restart" hover-class="restart-hover" @tap="$emit('restart')">重来</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import type { GameStatus } from '@/game/types';

defineProps<{
  visible: boolean;
  status: GameStatus;
  elapsedSeconds: number;
}>();

defineEmits<{
  restart: [];
}>();
</script>

<style scoped>
.modal-mask {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 36px;
  background: rgba(20, 25, 36, 0.56);
}

.modal {
  width: min(560px, 100%);
  padding: 38px 34px 32px;
  border-radius: 10px;
  background: #fffdf8;
  box-shadow: 0 18px 44px rgba(12, 18, 30, 0.28);
  text-align: center;
}

.title {
  display: block;
  font-size: 38px;
  font-weight: 900;
  line-height: 1.15;
  color: #1d2433;
}

.message {
  display: block;
  margin-top: 14px;
  font-size: 24px;
  line-height: 1.45;
  color: #667085;
}

.restart {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 60px;
  margin-top: 28px;
  border: 0;
  border-radius: 8px;
  background: #1f6feb;
  color: #fff;
  font-size: 24px;
  font-weight: 800;
  line-height: 60px;
}

.restart::after {
  border: 0;
}

.restart-hover {
  opacity: 0.88;
}
</style>

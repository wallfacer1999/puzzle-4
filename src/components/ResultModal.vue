<template>
  <view v-if="visible" class="modal-mask">
    <view class="modal">
      <text class="title">{{ status === 'success' ? '拼对了' : '差一点' }}</text>
      <text class="message">
        {{ status === 'success' ? `用时 ${elapsedSeconds} 秒，挑战完成` : '时间用完了，换个节奏再试一次' }}
      </text>
      <view class="actions">
        <button
          class="action primary"
          hover-class="press-feedback"
          hover-start-time="0"
          hover-stay-time="120"
          @click="$emit('restart')"
        >
          重来
        </button>
        <button
          v-if="status === 'success'"
          class="action secondary"
          hover-class="press-feedback"
          hover-start-time="0"
          hover-stay-time="120"
          open-type="share"
          @click="$emit('share')"
        >
          分享给朋友试试
        </button>
        <button
          v-else
          class="action secondary"
          hover-class="press-feedback"
          hover-start-time="0"
          hover-stay-time="120"
          :disabled="!canLowerDifficulty"
          @click="$emit('lower-difficulty')"
        >
          降低难度
        </button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import type { GameStatus } from '@/game/types';

defineProps<{
  visible: boolean;
  status: GameStatus;
  elapsedSeconds: number;
  canLowerDifficulty: boolean;
}>();

defineEmits<{
  restart: [];
  share: [];
  'lower-difficulty': [];
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
  animation: mask-fade 0.18s ease-out;
}

.modal {
  width: min(560px, 100%);
  padding: 38px 34px 32px;
  border-radius: 10px;
  background: #fffdf8;
  box-shadow: 0 18px 44px rgba(12, 18, 30, 0.28);
  text-align: center;
  animation: modal-pop 0.24s cubic-bezier(0.18, 0.9, 0.28, 1.16);
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

.actions {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-top: 28px;
}

.action {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 60px;
  margin: 0;
  border: 0;
  border-radius: 8px;
  font-size: 24px;
  font-weight: 800;
  line-height: 60px;
}

.action::after {
  border: 0;
}

.action.primary {
  background: #1f6feb;
  color: #fff;
}

.action.secondary {
  background: #ffe45c;
  color: #263143;
}

.action[disabled] {
  opacity: 0.45;
}

@keyframes mask-fade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes modal-pop {
  0% {
    opacity: 0;
    transform: translateY(10px) scale(0.94);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

</style>

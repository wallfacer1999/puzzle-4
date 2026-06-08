<template>
  <view v-if="visible" class="modal-mask">
    <view class="modal" :class="status">
      <image
        class="result-icon"
        :src="status === 'success' ? '/static/icons/result-success.png' : '/static/icons/result-failed.png'"
        mode="aspectFit"
      />
      <text class="title">{{ status === 'success' ? '难道我是天才？' : '可恶，还是做不到吗？' }}</text>
      <text class="message">
        {{
          status === 'success'
            ? `用时 ${elapsedSeconds} 秒，破解 T 字之谜。`
            : '这局被木块绕住了。换个角度，再压一把节奏。'
        }}
      </text>
      <view v-if="status === 'success'" class="actions">
        <button
          class="action primary success-action"
          hover-class="press-feedback"
          hover-start-time="0"
          hover-stay-time="120"
          open-type="share"
          data-share-scene="success"
          @click="$emit('share', 'success')"
        >
          晒一下战绩
        </button>
        <button
          class="action secondary"
          hover-class="press-feedback"
          hover-start-time="0"
          hover-stay-time="120"
          @click="$emit('restart')"
        >
          再来一局
        </button>
      </view>
      <view v-else class="actions">
        <button
          class="action primary failed-action"
          hover-class="press-feedback"
          hover-start-time="0"
          hover-stay-time="120"
          @click="$emit('restart')"
        >
          再挑战一次
        </button>
        <view class="action-row">
          <button
            class="action secondary"
            hover-class="press-feedback"
            hover-start-time="0"
            hover-stay-time="120"
            open-type="share"
            data-share-scene="failed"
            @click="$emit('share', 'failed')"
          >
            分享给朋友
          </button>
          <button
            class="action assist"
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
  share: [scene: 'success' | 'failed'];
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
  padding: 26px 26px 28px;
  border: 3px solid #263143;
  border-radius: 18px;
  background: linear-gradient(180deg, #fffdf8 0%, #fff1bd 100%);
  box-shadow: 8px 8px 0 rgba(38, 49, 67, 0.18), 0 18px 44px rgba(12, 18, 30, 0.28);
  text-align: center;
  animation: modal-pop 0.24s cubic-bezier(0.18, 0.9, 0.28, 1.16);
}

.modal.failed {
  background: linear-gradient(180deg, #fffdf8 0%, #e7f1ff 100%);
}

.result-icon {
  display: block;
  width: 104px;
  height: 104px;
  margin: -4px auto 8px;
}

.eyebrow {
  display: block;
  font-size: 18px;
  font-weight: 900;
  line-height: 1.2;
  color: #8a6b12;
}

.failed .eyebrow {
  color: #315b94;
}

.title {
  display: block;
  margin-top: 4px;
  font-size: 34px;
  font-weight: 900;
  line-height: 1.15;
  color: #1d2433;
}

.message {
  display: block;
  margin: 12px auto 0;
  max-width: 420px;
  font-size: 21px;
  font-weight: 700;
  line-height: 1.45;
  color: #5d6470;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 24px;
}

.action-row {
  display: flex;
  gap: 10px;
}

.action {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 56px;
  margin: 0;
  border: 0;
  border-radius: 12px;
  font-size: 21px;
  font-weight: 900;
  line-height: 56px;
}

.action::after {
  border: 0;
}

.action.primary {
  background: #263143;
  color: #fff;
}

.action.success-action {
  background: #1f6feb;
}

.action.failed-action {
  background: #1f6feb;
}

.action.secondary {
  background: #ffe45c;
  color: #263143;
}

.action.assist {
  background: rgba(38, 49, 67, 0.12);
  color: #263143;
}

.action[disabled] {
  opacity: 0.45;
}

@media (max-width: 520px) {
  .modal-mask {
    padding: 24px;
  }

  .modal {
    padding: 22px 18px 20px;
    border-radius: 16px;
  }

  .result-icon {
    width: 88px;
    height: 88px;
  }

  .title {
    font-size: 28px;
  }

  .message {
    font-size: 18px;
  }

  .action {
    height: 50px;
    font-size: 18px;
    line-height: 50px;
  }
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

<template>
  <slot />
</template>

<script setup lang="ts"></script>

<style>
page,
body {
  min-height: 100%;
  margin: 0;
  background: #f4f1ea;
  color: #1d2433;
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

view,
text {
  box-sizing: border-box;
}

.press-feedback {
  filter: brightness(1.05) saturate(1.06);
  opacity: 0.92;
  transform: translateY(1px) scale(0.985);
  box-shadow:
    inset 0 2px 8px rgba(38, 49, 67, 0.18),
    inset 0 0 0 999px rgba(255, 255, 255, 0.08);
  transition:
    opacity 90ms ease,
    filter 90ms ease,
    transform 90ms ease,
    box-shadow 90ms ease;
}
</style>

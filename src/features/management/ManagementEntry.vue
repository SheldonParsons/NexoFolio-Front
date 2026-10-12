<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
const auth = useAuthStore()
</script>
<template>
  <RouterLink v-if="auth.canManageProjects" to="/management" class="management-entry"
    ><span>管理中心</span></RouterLink
  >
</template>
<style>
.management-entry {
  position: fixed;
  left: calc(10px + env(safe-area-inset-left));
  bottom: calc(8px + env(safe-area-inset-bottom));
  z-index: 30;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: max-content;
  min-height: 34px;
  padding: 5px;
  border: 0;
  background: transparent;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.5;
  pointer-events: auto;
  touch-action: manipulation;
}
.management-entry span {
  padding: 3px 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg);
  box-shadow: 0 2px 8px #0000000c;
}
.management-entry:hover span {
  color: var(--text);
  background: var(--surface-muted);
}
.management-entry:focus-visible {
  outline: none;
}
.management-entry:focus-visible span {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}
@media (pointer: coarse) {
  .management-entry {
    min-height: 44px;
    padding-inline: 7px;
  }
}
html[data-page='home'] .management-entry {
  --bg: #111;
  --surface-muted: #222;
  --text: #f5f5f3;
  --muted: #b5b5b5;
  --border: #383838;
  --focus: #ddd;
}
</style>

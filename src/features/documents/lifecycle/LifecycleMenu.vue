<script setup lang="ts">
import { computed } from 'vue'
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuItem,
} from 'reka-ui'
import AppIcon from '@/components/icons/AppIcon.vue'
import { useLifecycle } from './context'
import type { LifecycleTarget } from './model'
import { sameTarget } from './model'
import '@/features/curation/review-menu.css'
const props = defineProps<{
  target: LifecycleTarget
  name: string
  variant?: 'default' | 'tree'
}>()
const lifecycle = useLifecycle()
const decision = computed(() => lifecycle?.get(props.target))
const inherited = computed(() => decision.value && !sameTarget(decision.value.target, props.target))
function edit() {
  const target = decision.value?.target ?? props.target
  lifecycle?.edit(target, inherited.value ? '所属接口、字段或目录' : props.name)
}
</script>
<template>
  <DropdownMenuRoot
    v-if="lifecycle?.writable && !(target.kind === 'folder' && target.id === 'unplaced')"
  >
    <DropdownMenuTrigger
      class="curation-review-menu-trigger lifecycle-trigger"
      :class="{ 'lifecycle-tree-trigger': variant === 'tree' }"
      :aria-label="name + '的更多操作'"
      @click.stop
      ><AppIcon name="more-horizontal" :size="15" mode="static"
    /></DropdownMenuTrigger>
    <DropdownMenuPortal
      ><DropdownMenuContent
        class="curation-review-menu"
        align="end"
        :side-offset="5"
        :collision-padding="10"
      >
        <DropdownMenuItem class="curation-review-menu-item" @select="edit">{{
          inherited ? '管理所属对象的废弃状态' : decision ? '撤销废弃' : '废弃'
        }}</DropdownMenuItem>
      </DropdownMenuContent></DropdownMenuPortal
    >
  </DropdownMenuRoot>
</template>
<style scoped>
.lifecycle-trigger {
  flex: none;
  width: 26px;
  height: 26px;
}
.lifecycle-trigger.lifecycle-tree-trigger {
  position: absolute;
  right: 2px;
  top: 50%;
  transform: translateY(-50%);
  border: 0;
  background: var(--surface-muted);
  box-shadow: none;
  color: var(--muted);
  cursor: pointer;
  transition:
    color 120ms ease,
    opacity 120ms ease;
}
.lifecycle-trigger.lifecycle-tree-trigger:is(:hover, :focus-visible, [data-state='open']) {
  background: var(--surface-muted);
  color: var(--text);
}
@media (hover: hover) and (pointer: fine) {
  .lifecycle-trigger.lifecycle-tree-trigger {
    opacity: var(--document-tree-action-opacity, 0);
    pointer-events: var(--document-tree-action-pointer-events, none);
  }
  .lifecycle-trigger.lifecycle-tree-trigger:is(:focus-visible, [data-state='open']) {
    opacity: 1;
    pointer-events: auto;
  }
}
.lifecycle-trigger.lifecycle-tree-trigger:focus-visible {
  outline: 2px solid var(--focus, var(--text));
  outline-offset: 2px;
}
@media (pointer: coarse), (hover: none) {
  .lifecycle-trigger.lifecycle-tree-trigger {
    position: static;
    transform: none;
    width: 36px;
    height: 36px;
    background: transparent;
  }
}
@media (prefers-reduced-motion: reduce) {
  .lifecycle-trigger.lifecycle-tree-trigger {
    transition: none;
  }
}
</style>

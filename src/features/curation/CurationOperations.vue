<script setup lang="ts">
import { ref, watch } from 'vue'
import { PopoverRoot, PopoverTrigger, PopoverPortal, PopoverContent, PopoverClose } from 'reka-ui'
import AppIcon from '@/components/icons/AppIcon.vue'
import { formatTime } from '@/features/documents/presentation'
import { useCandidateOperations } from './useCandidateOperations'
import { actorLabel, operationLabels, operationNote } from './operationPresentation'
import './operations.css'
const props = defineProps<{ projectId: string; candidateId: string; revision: string }>()
const emit = defineEmits<{ unauthorized: [] }>()
const open = ref(false)
const history = useCandidateOperations(
  () => props.projectId,
  () => props.candidateId,
  () => open.value,
  () => emit('unauthorized'),
)
watch(
  () => props.candidateId,
  () => {
    open.value = false
  },
  { flush: 'sync' },
)
watch(
  () => props.revision,
  () => {
    if (open.value) void history.load()
  },
)
</script>
<template>
  <PopoverRoot v-model:open="open" :modal="false">
    <PopoverTrigger class="curation-operations-trigger"
      ><AppIcon name="user-round" :size="14" mode="static" />操作记录<AppIcon
        name="chevron-down"
        :size="11"
    /></PopoverTrigger>
    <PopoverPortal
      ><PopoverContent
        class="curation-operations-panel"
        side="bottom"
        align="start"
        :side-offset="6"
        :collision-padding="12"
        aria-label="本轮操作记录"
      >
        <header>
          <strong>本轮操作记录</strong
          ><PopoverClose class="curation-operations-close" aria-label="关闭操作记录"
            ><AppIcon name="x" :size="14"
          /></PopoverClose>
        </header>
        <p
          v-if="history.loading.value && !history.events.value.length"
          class="curation-operations-state"
          role="status"
        >
          正在读取操作记录…
        </p>
        <p v-if="history.error.value" class="curation-operations-state" role="alert">
          {{ history.error.value }} <button type="button" @click="history.load">重试</button>
        </p>
        <ol class="curation-operations-list">
          <li v-for="event in history.events.value" :key="event.id">
            <span class="curation-operation-avatar"
              ><AppIcon
                v-if="event.actor.kind === 'system'"
                name="settings"
                :size="15"
                mode="static"
              /><AppIcon
                v-else-if="event.actor.kind === 'unknown'"
                name="circle-help"
                :size="15"
                mode="static"
              /><span v-else>{{ Array.from(actorLabel(event.actor))[0] }}</span></span
            >
            <div>
              <div class="curation-operation-title">
                <strong :title="event.actor.kind === 'user' ? event.actor.id : undefined">{{
                  actorLabel(event.actor)
                }}</strong
                ><span>{{ operationLabels[event.action] }}</span>
              </div>
              <time :datetime="event.at">{{ formatTime(event.at) }}</time
              ><small v-if="operationNote(event)">{{ operationNote(event) }}</small>
            </div>
          </li>
        </ol>
        <p v-if="history.namesUnavailable.value" class="curation-operations-state">
          部分旧用户资料暂不可用，已保留的身份记录仍可查看。<button
            type="button"
            @click="history.load"
          >
            重新读取
          </button>
        </p>
      </PopoverContent></PopoverPortal
    >
  </PopoverRoot>
</template>

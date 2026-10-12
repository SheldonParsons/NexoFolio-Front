<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import AppDialog from '@/components/ui/AppDialog.vue'
import { useLifecycle } from './context'
import type { DocumentIndex } from '../source'
import { documentLocation } from '../documentRoutes'
import { sameTarget, type LifecycleTarget } from './model'
const props = defineProps<{
  index: DocumentIndex | null
  projectId: string
  environmentId: string
}>()
const lifecycle = useLifecycle()!
const reason = ref('')
const inherited = computed(
  () =>
    lifecycle.editing.value &&
    lifecycle.get(lifecycle.editing.value.target) &&
    !sameTarget(
      lifecycle.get(lifecycle.editing.value.target)!.target,
      lifecycle.editing.value.target,
    ),
)
const decision = computed(() => lifecycle.editing.value?.retired === false)
const stale = computed(
  () =>
    !!lifecycle.editing.value && lifecycle.editing.value.version !== lifecycle.state.value.version,
)
watch(lifecycle.editing, () => (reason.value = ''))
const editOpen = computed({
  get: () => !!lifecycle.editing.value,
  set: (v: boolean) => {
    if (!v && !lifecycle.busy.value) lifecycle.editing.value = null
  },
})
function name(target: LifecycleTarget) {
  return target.kind === 'folder'
    ? props.index?.catalog.folders.find((f) => f.id === target.id)?.name || target.id
    : (props.index?.entries.find(
        (e) => e.interface_id === (target.kind === 'field' ? target.endpoint : target.id),
      )?.name ||
        props.index?.entries.find(
          (e) => e.interface_id === (target.kind === 'field' ? target.endpoint : target.id),
        )?.path ||
        (target.kind === 'field' ? target.endpoint : target.id)) +
        (target.kind === 'field'
          ? ' · ' +
            target.location.in +
            ':' +
            target.path.map((s) => (typeof s === 'string' ? '[]' : s.key)).join('.')
          : '')
}
function restore(target: LifecycleTarget) {
  lifecycle.panelOpen.value = false
  lifecycle.edit(target, name(target))
}
function locate() {
  lifecycle.showRetired.value = true
  lifecycle.panelOpen.value = false
}
function to(target: LifecycleTarget) {
  return documentLocation(
    props.projectId,
    target.kind === 'field' ? { kind: 'endpoint', id: target.endpoint } : target,
    props.environmentId,
  )
}
</script>
<template>
  <AppDialog
    v-model:open="lifecycle.panelOpen.value"
    title="废弃内容"
    description="直接废弃决定按对象计数；接口字段和目录子项的继承影响不重复计数。"
  >
    <div class="lifecycle-items">
      <article
        v-for="item in lifecycle.state.value.decisions.filter((d) => d.retired)"
        :key="item.version"
      >
        <RouterLink :to="to(item.target)" @click="locate"
          ><s>{{ name(item.target) }}</s></RouterLink
        >
        <p>{{ item.reason }}</p>
        <p>
          {{ item.actor.display_name || '操作人未记录' }} ·
          {{ new Date(item.at).toLocaleString('zh-CN') }}
        </p>
        <button
          v-if="lifecycle.writable"
          class="document-secondary-button"
          @click="restore(item.target)"
        >
          撤销废弃
        </button>
      </article>
      <p v-if="!lifecycle.count.value">暂无废弃内容。</p>
    </div>
  </AppDialog>
  <AppDialog
    v-model:open="editOpen"
    :dismissible="!lifecycle.busy.value"
    :title="decision ? '撤销废弃' : '废弃内容'"
    :description="lifecycle.editing.value?.name || ''"
  >
    <form class="lifecycle-form" @submit.prevent="lifecycle.save(reason)">
      <p v-if="stale" role="status">状态已变化，请关闭弹窗后重新选择操作。</p>
      <p v-if="inherited">
        此对象仍继承所属接口、字段或目录的废弃状态。撤销这条直接决定不会撤销所属对象的决定。
      </p>
      <p>
        {{
          decision
            ? '撤销当前废弃决定后仍需开始新一轮整理，重新核对相关知识。'
            : '本项目全部环境生效，原始样本和历史保留。下一轮整理将排除废弃内容。'
        }}
      </p>
      <p v-if="lifecycle.editing.value?.target.kind === 'folder'">
        包括此目录及子目录的结构与介绍；目录内仍有效的接口将重新分类。
      </p>
      <p v-if="lifecycle.editing.value?.target.kind === 'endpoint'">
        此接口的全部字段随接口状态变化。
      </p>
      <label v-if="!decision"
        >废弃原因<textarea v-model="reason" required maxlength="1000" rows="3" autofocus />
      </label>
      <p v-if="lifecycle.error.value" role="alert">{{ lifecycle.error.value }}</p>
      <button
        class="document-organize"
        type="submit"
        :disabled="lifecycle.busy.value || stale || (!decision && !reason.trim())"
      >
        {{ lifecycle.busy.value ? '保存中…' : decision ? '确认撤销废弃' : '确认废弃' }}
      </button>
    </form>
  </AppDialog>
</template>
<style scoped>
.lifecycle-items {
  max-height: 60vh;
  overflow: auto;
}
.lifecycle-items article {
  padding: 14px 0;
  border-bottom: 1px solid var(--border);
}
.lifecycle-items p,
.lifecycle-form p {
  font-size: 12px;
  line-height: 1.7;
  overflow-wrap: anywhere;
}
.lifecycle-items a {
  color: var(--text);
  overflow-wrap: anywhere;
}
.lifecycle-form {
  display: grid;
  gap: 14px;
}
.lifecycle-form label {
  display: grid;
  gap: 8px;
}
.lifecycle-form textarea {
  width: 100%;
  box-sizing: border-box;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 10px;
  font: inherit;
}
.lifecycle-form button {
  justify-self: end;
}
</style>

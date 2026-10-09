<script setup lang="ts">
import { computed, ref } from 'vue'
import type { KnowledgeChange } from './changes'
import type { Candidate } from './types'
import { reviewLines } from './reviewLines'
import { reviewComparison } from './reviewComparison'
const props = defineProps<{ change: KnowledgeChange; candidate: Candidate }>()
const onlyChanges = ref(true)
const before = computed(() => reviewLines(props.change, props.change.before, props.candidate))
const after = computed(() => reviewLines(props.change, props.change.after, props.candidate))
const rows = computed(() => reviewComparison(before.value, after.value))
const visibleRows = computed(() => rows.value.filter((row) => !onlyChanges.value || row.changed))
const sides = computed(() =>
  (['before', 'after'] as const).map((key) => ({
    key,
    title: key === 'before' ? '现行文档' : '候选结果',
    exists: !!props.change[key],
    lines:
      props.change.section === 'fields' && props.change[key]
        ? visibleRows.value.map(
            (row) => row[key] ?? { label: row.label, values: ['未记录'], subtle: true },
          )
        : key === 'before'
          ? before.value
          : after.value,
  })),
)
</script>
<template>
  <article class="curation-change-detail">
    <header>
      <div class="curation-change-toolbar">
        <span class="curation-change-status" :data-kind="change.status">{{
          { added: '新增', updated: '更新', removed: '移除' }[change.status]
        }}</span>
        <label v-if="change.section === 'fields'" class="curation-changes-only">
          <input v-model="onlyChanges" type="checkbox" />只看变化
        </label>
      </div>
      <h2>{{ change.title }}</h2>
      <p>{{ change.subtitle }}</p>
    </header>
    <div class="curation-comparison">
      <section v-for="side in sides" :key="side.key" :class="'curation-' + side.key">
        <h3>{{ side.title }}</h3>
        <p v-if="!side.lines.length" class="curation-empty-side">
          {{
            side.exists
              ? '当前展示项没有差异，可取消“只看变化”查看完整内容。'
              : side.key === 'before'
                ? '现行文档尚无此项知识'
                : '本轮建议移除此项'
          }}
        </p>
        <dl v-else>
          <div v-for="line in side.lines" :key="line.label" :class="{ 'is-subtle': line.subtle }">
            <dt>{{ line.label }}</dt>
            <dd>
              <p v-for="(text, i) in line.values" :key="i">
                <code v-if="line.code">{{ text }}</code
                ><template v-else>{{ text }}</template>
              </p>
            </dd>
          </div>
        </dl>
      </section>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import AppIcon from '@/components/icons/AppIcon.vue'
import { useIconInteraction } from '@/components/motion/useIconInteraction'
import { fieldPath, groupFields, typeList } from './fieldPresentation'
import type { EndpointCard, EndpointDetail } from '@/contracts/knowledge/types'

const props = defineProps<{
  card: EndpointCard | null
  detail: EndpointDetail | null
  loading: boolean
  error: string
  describing: boolean
}>()
const emit = defineEmits<{ describe: [id: string]; close: [] }>()

const closeMotion = useIconInteraction()
const describeMotion = useIconInteraction()

const summary = computed(() => props.detail?.facts.summary ?? null)
const note = computed(() => props.detail?.knowledge?.note ?? null)
const groups = computed(() => (props.detail ? groupFields(props.detail.facts.fields) : []))
const calls = computed(() =>
  (summary.value?.environments ?? []).reduce((sum, env) => sum + env.calls, 0),
)
const breadcrumb = computed(() => props.detail?.knowledge?.path?.map((f) => f.name) ?? [])
const author = computed(() => {
  const by = note.value?.author
  if (!by) return ''
  return by.by === 'curate' ? `由整理写入 · ${by.model ?? '模型'}` : '由人编辑'
})
const endpointId = computed(() => props.card?.interface_id ?? summary.value?.id ?? '')
</script>

<template>
  <aside class="cd-panel" aria-label="接口详情">
    <header class="cd-head">
      <span
        class="cd-method"
        :data-method="(card?.method || summary?.method || '').toUpperCase()"
        >{{ (card?.method || summary?.method || '').toUpperCase() }}</span
      >
      <button
        type="button"
        class="cd-close"
        aria-label="关闭详情"
        :data-interacting="closeMotion.active.value"
        v-on="closeMotion.events"
        @click="emit('close')"
      >
        <AppIcon name="x" :size="15" />
      </button>
    </header>

    <h2 class="cd-title">{{ card?.name || note?.name || '还没有命名' }}</h2>
    <p class="cd-path">{{ card?.path || summary?.path_template }}</p>

    <nav v-if="breadcrumb.length" class="cd-crumbs" aria-label="所在目录">
      <template v-for="(name, index) in breadcrumb" :key="name + index">
        <span v-if="index" aria-hidden="true">/</span><b>{{ name }}</b>
      </template>
    </nav>

    <button
      type="button"
      class="cd-describe"
      :aria-busy="describing"
      :data-interacting="describeMotion.active.value"
      v-on="describeMotion.events"
      @click="endpointId && emit('describe', endpointId)"
    >
      <AppIcon name="scan-search" :size="15" />
      <span>{{ note ? '重新生成说明' : '生成说明' }}</span>
      <span v-if="describing" class="ct-pulse" aria-hidden="true"><i></i><i></i><i></i></span>
    </button>

    <div v-if="loading" class="cd-state" role="status">
      <span class="catalog-state-mark" aria-hidden="true"><i></i><i></i><i></i></span>
      <p>读取接口事实</p>
    </div>
    <p v-else-if="error" class="cd-state" role="alert">{{ error }}</p>

    <div v-else-if="detail" class="cd-scroll">
      <section v-if="note?.purpose || card?.purpose" class="cd-block">
        <h3>用途</h3>
        <p class="cd-purpose">{{ note?.purpose || card?.purpose }}</p>
        <p v-if="author" class="cd-author">{{ author }}</p>
      </section>

      <section class="cd-block">
        <h3>观测</h3>
        <dl class="cd-facts">
          <div>
            <dt>调用</dt>
            <dd>{{ calls }}</dd>
          </div>
          <div>
            <dt>环境</dt>
            <dd>{{ summary?.environments.length ?? 0 }}</dd>
          </div>
          <div>
            <dt>样本</dt>
            <dd>{{ detail.facts.examples.length }}</dd>
          </div>
          <div>
            <dt>字段</dt>
            <dd>{{ detail.facts.fields.length }}</dd>
          </div>
        </dl>
      </section>

      <section v-for="group in groups" :key="group.label" class="cd-block">
        <h3>
          {{ group.label }} <span>{{ group.fields.length }}</span>
        </h3>
        <ul class="cd-fields">
          <li v-for="(field, index) in group.fields.slice(0, 60)" :key="index">
            <code>{{ fieldPath(field.path) }}</code>
            <em>{{ typeList(field.types) }}</em>
            <i v-if="field.conflict" class="cd-conflict" title="声明与实际流量不一致">冲突</i>
          </li>
        </ul>
        <p v-if="group.fields.length > 60" class="cd-more">
          还有 {{ group.fields.length - 60 }} 个字段，完整内容见接口文档页
        </p>
      </section>
    </div>
  </aside>
</template>

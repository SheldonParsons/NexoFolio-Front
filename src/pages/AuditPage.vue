<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import RawAuditRecords from '@/features/audit/RawAuditRecords.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppTabs from '@/components/ui/AppTabs.vue'
import AccessAnalysis from '@/features/audit/AccessAnalysis.vue'
import CurationDiagnostics from '@/features/audit/CurationDiagnostics.vue'
import '@/features/audit/console.css'
const rawOpen = ref(false)
const route = useRoute(),
  router = useRouter()
const tab = computed({
  get: () => (route.query.tab === 'curation' ? 'curation' : 'access'),
  set: (value) => {
    void router.push({ query: { ...route.query, tab: value } })
  },
})
</script>
<template>
  <section class="audit-console" aria-label="内容审计" data-scroll-container>
    <header class="audit-console-heading">
      <p class="management-eyebrow">管理中心 / 内容审计</p>
      <h1>内容审计</h1>
      <p>了解访问热点，追溯单次访问，排查具体一轮整理。</p>
    </header>
    <div class="audit-advanced-entry">
      <AppButton variant="ghost" @click="rawOpen = true">高级记录查询</AppButton>
    </div>
    <AppTabs
      v-model="tab"
      label="审计任务"
      :options="[
        { value: 'access', label: '访问分析' },
        { value: 'curation', label: '整理排查' },
      ]"
      ><template #access><AccessAnalysis /></template
      ><template #curation><CurationDiagnostics /></template
    ></AppTabs>
    <RawAuditRecords v-if="rawOpen" v-model:open="rawOpen" />
  </section>
</template>

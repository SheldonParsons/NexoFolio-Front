<script setup lang="ts">
import { computed, ref } from 'vue'
import AppIcon from '@/components/icons/AppIcon.vue'
import type { IconName } from '@/components/icons/registry'
const stages: { label: string; icon: IconName; caption: string }[] = [
  { label: '发现接口', icon: 'code', caption: '从一次真实调用开始，保留请求与响应的线索。' },
  { label: '组织知识', icon: 'folder', caption: '将接口归入业务目录，让定义与证据各有位置。' },
  { label: '交给 Agent', icon: 'layers', caption: '按需读取上下文，让回答有出处、调用有依据。' },
]
const active = ref(1)
const stage = computed(() => stages[active.value]!)
</script>

<template>
  <div class="knowledge-preview">
    <div class="preview-chrome">
      <div class="window-dots" aria-hidden="true"><i></i><i></i><i></i></div>
      <span><AppIcon name="network" :size="13" />知识空间 / 订单服务</span
      ><span class="demo-label">交互示意</span>
    </div>
    <div class="preview-workspace">
      <aside class="preview-directory" aria-label="示意目录">
        <div class="preview-side-title">知识目录 <span aria-hidden="true">＋</span></div>
        <div class="preview-tree-item">
          <AppIcon name="chevron-right" :size="12" /><AppIcon name="folder" :size="15" />用户与权限
        </div>
        <div class="preview-tree-item tree-parent">
          <AppIcon name="chevron-right" :size="12" class="tree-chevron-open" /><AppIcon
            name="folder"
            :size="15"
          />订单服务
        </div>
        <div class="preview-tree-nested">
          <div class="preview-tree-item"><AppIcon name="code" :size="14" />创建订单</div>
          <div class="preview-tree-item tree-selected">
            <span class="method-mini">GET</span>查询订单详情
          </div>
          <div class="preview-tree-item"><AppIcon name="code" :size="14" />取消订单</div>
        </div>
        <div class="preview-tree-item">
          <AppIcon name="chevron-right" :size="12" /><AppIcon name="folder" :size="15" />商品与库存
        </div>
        <div class="preview-side-bottom">
          <span class="small-status-dot"></span>每条知识，都有来源
        </div>
      </aside>
      <div class="preview-document" aria-live="polite" aria-atomic="true">
        <div class="document-breadcrumb">
          订单服务 <span>/</span> 查询订单详情 <span class="sample-tag">示例数据</span>
        </div>
        <div class="document-title">
          <span class="endpoint-method">GET</span>
          <h3>/orders/{id}</h3>
          <AppIcon :name="stage.icon" :size="20" />
        </div>
        <p class="document-description">通过订单编号，读取订单信息与当前处理状态。</p>
        <div v-if="active === 0" :key="active" class="preview-stage">
          <div class="document-section-label">一次调用，两份证据</div>
          <div class="capture-line">
            <span>REQUEST</span><code>GET /orders/ORD-1024</code
            ><span class="capture-ok">200 OK</span>
          </div>
          <pre class="response-code"><span>{</span>
  <b>"id"</b>: <em>"ORD-1024"</em>,
  <b>"status"</b>: <em>"processing"</em>,
  <b>"total"</b>: <strong>128.00</strong>
<span>}</span></pre>
        </div>
        <div v-else-if="active === 1" :key="active" class="preview-stage">
          <div class="document-tabs">
            <span class="document-tab-active">接口概览</span><span>调用证据</span
            ><span>变更记录</span>
          </div>
          <div class="document-section-label">请求参数</div>
          <div class="parameter-row">
            <code>id</code><span>string</span>
            <p>要查询的订单编号</p>
            <span class="required-tag">必填</span>
          </div>
          <div class="context-note">
            <AppIcon name="book" :size="16" />
            <div>
              <strong>不止是字段，还有业务上下文。</strong>
              <p>关联使用场景、状态说明，以及这条知识的来源。</p>
            </div>
          </div>
        </div>
        <div v-else :key="active" class="preview-stage agent-stage">
          <div class="agent-question">查询订单详情，需要传哪些参数？</div>
          <div class="agent-answer">
            <AppIcon name="layers" :size="17" />
            <div>
              <p>调用 <code>GET /orders/{id}</code>，在路径中传入订单编号 <code>id</code>。</p>
              <span class="answer-source"
                ><AppIcon name="book" :size="12" />订单服务 / 查询订单详情 · 示例</span
              >
            </div>
          </div>
        </div>
        <div class="document-footnote">
          <AppIcon name="check" :size="12" />为可追溯的知识而设计<span
            >概念演示 · 非实时业务数据</span
          >
        </div>
      </div>
    </div>
    <div class="preview-controls">
      <div role="group" aria-label="切换知识流程示意">
        <button
          v-for="(item, index) in stages"
          :key="item.label"
          type="button"
          :aria-pressed="active === index"
          :class="{ active: active === index }"
          @click="active = index"
        >
          <span>0{{ index + 1 }}</span
          >{{ item.label }}
        </button>
      </div>
      <p>{{ stage.caption }}</p>
    </div>
  </div>
</template>

<style scoped>
.knowledge-preview {
  text-align: left;
  border: 1px solid #292929;
  border-radius: 14px;
  overflow: hidden;
  background: #090909;
  box-shadow: 0 0 0 7px #ffffff03;
}
.preview-chrome {
  display: flex;
  align-items: center;
  gap: 22px;
  height: 46px;
  padding: 0 20px;
  border-bottom: 1px solid #222;
  background: #101010;
  color: #a5a5a5;
  font-size: 10px;
}
.preview-chrome > span {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}
.window-dots {
  display: flex;
  gap: 6px;
}
.window-dots i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #444;
}
.preview-chrome .demo-label {
  margin-left: auto;
  color: #828282;
  font-size: 10px;
}
.preview-workspace {
  display: grid;
  grid-template-columns: 214px minmax(0, 1fr);
  min-height: 337px;
}
.preview-directory {
  border-right: 1px solid #222;
  padding: 24px 12px 18px;
  display: flex;
  flex-direction: column;
  color: #8e8e8e;
  font-size: 11px;
}
.preview-side-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 10px;
  margin-bottom: 18px;
  color: #c3c3c3;
  font-size: 10px;
}
.preview-side-title > span {
  font-size: 16px;
  color: #777;
}
.preview-tree-item {
  min-height: 32px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  white-space: nowrap;
}
.tree-parent {
  color: #ddd;
}
.tree-chevron-open {
  transform: rotate(90deg);
}
.preview-tree-nested {
  margin-left: 14px;
  padding-left: 10px;
  border-left: 1px solid #262626;
}
.tree-selected {
  background: #1e1e1e;
  color: #eee;
  border: 1px solid #303030;
  border-radius: 5px;
}
.method-mini {
  font-family: monospace;
  font-size: 9px;
  color: #c9d4c1;
}
.preview-side-bottom {
  margin-top: auto;
  padding: 22px 10px 0;
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 9px;
  color: #7d7d7d;
}
.small-status-dot {
  width: 4px;
  height: 4px;
  background: #9aab91;
  border-radius: 50%;
}
.preview-document {
  min-width: 0;
  padding: 25px 31px 17px;
  display: flex;
  flex-direction: column;
}
.document-breadcrumb {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #999;
  font-size: 10px;
}
.document-breadcrumb > span:not(.sample-tag) {
  color: #555;
}
.sample-tag {
  margin-left: auto;
  color: #aaa;
  border: 1px solid #303030;
  border-radius: 4px;
  padding: 1px 5px;
  font-size: 9px;
}
.document-title {
  display: flex;
  align-items: center;
  gap: 11px;
  margin-top: 21px;
}
.document-title h3 {
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-weight: 450;
  font-size: 21px;
  color: #eee;
  letter-spacing: -0.5px;
}
.document-title > svg {
  margin-left: auto;
  color: #9a9a9a;
}
.endpoint-method {
  color: #c8d6b9;
  font-family: monospace;
  font-size: 10px;
  background: #b3cf9810;
  border: 1px solid #b3cf982b;
  padding: 3px 7px;
  border-radius: 4px;
}
.document-description {
  margin-top: 9px;
  color: #929292;
  font-size: 11px;
}
.preview-stage {
  min-height: 202px;
  animation: stage-in 160ms ease-out;
}
.document-tabs {
  display: flex;
  gap: 24px;
  margin-top: 23px;
  border-bottom: 1px solid #242424;
  font-size: 10px;
  color: #909090;
}
.document-tabs span {
  padding-bottom: 10px;
}
.document-tabs .document-tab-active {
  color: #e6e6e6;
  border-bottom: 1px solid #e6e6e6;
}
.document-section-label {
  color: #bebebe;
  font-size: 10px;
  margin: 16px 0 10px;
}
.parameter-row {
  display: flex;
  align-items: center;
  gap: 18px;
  font-size: 10px;
  color: #999;
}
.parameter-row code {
  color: #e0d0b5;
}
.parameter-row > p {
  margin: 0;
}
.required-tag {
  margin-left: auto;
  font-size: 9px;
  border: 1px solid #343434;
  border-radius: 4px;
  padding: 1px 5px;
  color: #aaa;
}
.context-note {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  background: #121212;
  border: 1px solid #272727;
  border-radius: 6px;
  padding: 12px;
  margin-top: 17px;
}
.context-note > svg {
  color: #ada796;
}
.context-note strong {
  color: #c7c7c7;
  font-size: 10px;
  font-weight: 450;
}
.context-note p {
  color: #969696;
  font-size: 10px;
  margin-top: 5px;
}
.document-footnote {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #959595;
  font-size: 9px;
  padding-top: 17px;
  margin-top: auto;
}
.document-footnote span {
  margin-left: auto;
  color: #777;
}
.capture-line {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 10px;
  color: #999;
}
.capture-line code {
  color: #ccc;
}
.capture-ok {
  margin-left: auto;
  color: #bdcfae;
}
.response-code {
  margin: 12px 0 0;
  background: #121212;
  border: 1px solid #272727;
  border-radius: 6px;
  padding: 11px 16px;
  color: #999;
  font-size: 11px;
  line-height: 1.6;
}
.response-code b {
  color: #ccc;
  font-weight: 400;
}
.response-code em {
  color: #c8d6b9;
  font-style: normal;
}
.response-code strong {
  color: #d7c4a6;
  font-weight: 400;
}
.agent-stage {
  padding-top: 20px;
}
.agent-question {
  font-size: 11px;
  color: #ddd;
  background: #181818;
  border: 1px solid #303030;
  border-radius: 8px 8px 2px 8px;
  padding: 10px 13px;
  width: fit-content;
  margin-left: auto;
}
.agent-answer {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-top: 20px;
  color: #b4b4b4;
  font-size: 11px;
  line-height: 1.8;
}
.agent-answer > svg {
  color: #d4c8b2;
  margin-top: 3px;
}
.agent-answer code {
  color: #e2d4bc;
}
.answer-source {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #a5a5a5;
  font-size: 9px;
  border: 1px solid #303030;
  border-radius: 4px;
  padding: 2px 6px;
  margin-top: 10px;
}
.preview-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 16px 20px;
  border-top: 1px solid #222;
  background: #0d0d0d;
}
.preview-controls > div {
  display: flex;
  gap: 5px;
}
.preview-controls button {
  display: flex;
  align-items: center;
  gap: 8px;
  background: transparent;
  border: 1px solid transparent;
  color: #a3a3a3;
  padding: 8px 11px;
  min-height: 44px;
  border-radius: 6px;
  font-size: 10px;
  white-space: nowrap;
}
.preview-controls button > span {
  font-family: monospace;
  font-size: 9px;
  color: #777;
}
.preview-controls button:hover {
  color: white;
  background: #1a1a1a;
}
.preview-controls button.active {
  background: #222;
  border-color: #373737;
  color: #fff;
}
.preview-controls p {
  font-size: 10px;
  color: #929292;
  max-width: 240px;
  line-height: 1.8;
}
@keyframes stage-in {
  from {
    opacity: 0;
    transform: translateY(3px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@media (max-width: 760px) {
  .preview-workspace {
    grid-template-columns: 165px minmax(0, 1fr);
  }
  .preview-document {
    padding: 20px;
  }
  .preview-controls {
    align-items: flex-start;
    flex-direction: column;
    gap: 10px;
  }
  .preview-controls p {
    max-width: unset;
  }
  .document-footnote > span {
    display: none;
  }
  .parameter-row {
    gap: 10px;
  }
}
@media (max-width: 540px) {
  .preview-directory {
    display: none;
  }
  .preview-workspace {
    grid-template-columns: minmax(0, 1fr);
  }
  .preview-document {
    padding: 20px 16px;
  }
  .preview-controls {
    padding: 14px 10px;
  }
  .preview-controls > div {
    width: 100%;
    justify-content: space-between;
  }
  .preview-controls button {
    padding: 8px;
  }
  .preview-controls p {
    padding-inline: 7px;
  }
  .document-title h3 {
    font-size: 19px;
  }
  .preview-chrome {
    padding-inline: 14px;
    gap: 12px;
  }
  .preview-chrome > span {
    font-size: 9px;
  }
  .document-breadcrumb {
    gap: 8px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .preview-stage {
    animation: none;
  }
}
</style>

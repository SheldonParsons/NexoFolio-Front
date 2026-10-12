<script setup lang="ts">
import { computed, nextTick, onScopeDispose, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import AppIcon from '@/components/icons/AppIcon.vue'
import { apiBaseUrl } from '@/api'
import { useActiveProject } from '@/features/projects/useActiveProject'
import { mcpDocumentationLinks } from './environment'
import {
  makeMcpConfig,
  exampleProjectName,
  mcpFaqs,
  mcpRelease,
  mcpPurpose,
  mcpRetrievalPaths,
  mcpReadingRules,
  mcpScenarios,
  mcpToolArguments,
  mcpTools,
} from './content'
import './mcp-guide.css'
import {
  mcpConversation,
  mcpCoverageCapabilities,
  mcpInstallPrompt,
  mcpInstallSteps,
} from './onboarding'
const links = mcpDocumentationLinks(apiBaseUrl, window.location.href, import.meta.env.BASE_URL)
const activeProject = useActiveProject()
const exampleContext = computed(() => ({
  projectId: activeProject.current.value?.projectId,
  environmentId: activeProject.current.value?.environmentId,
}))
const installPrompt = computed(() =>
  mcpInstallPrompt(links.documentUrl, { ...links, ...exampleContext.value }),
)
const scenarios = computed(() =>
  mcpScenarios.map((item) => ({
    ...item,
    prompt: item.prompt.replaceAll(
      exampleProjectName,
      activeProject.current.value?.name || exampleProjectName,
    ),
  })),
)

const activeStep = ref(0)
const stepLabels = ['准备授权', '配置客户端', '确认连接']
const steps = ref<HTMLButtonElement[]>([])
const startSection = ref<HTMLElement>()
const toolSection = ref<HTMLElement>()
const activeTool = ref(0)
const toolButtons = ref<HTMLButtonElement[]>([])
const tool = computed(() => mcpTools[activeTool.value]!)
const unplaced = ref(false)
const argumentsText = computed(() =>
  JSON.stringify(mcpToolArguments(activeTool.value, unplaced.value, exampleContext.value), null, 2),
)
const address = ref(links.serviceUrl)
const config = computed(() => makeMcpConfig(address.value))
const copied = ref('')
const copyError = ref('')
const checklist = ref<string[]>([])
const checkItems = [
  `initialize 成功，列出 ${mcpTools.length} 个工具并确认 field_summary、coverage summary/issues 定义`,
  '按项目和环境名称取得真实 ID，完成目录浏览或搜索',
  '按问题读完整字段语义，并核对相关引用和确认状态',
  '按需核对原文、上下文及续读；缺少样本时明确哪些尚未验证',
]
let timer: ReturnType<typeof setTimeout> | undefined
watch([activeStep, activeTool, unplaced, address], () => {
  clearTimeout(timer)
  copied.value = ''
  copyError.value = ''
})
const scrollOptions = () => ({
  block: 'start' as const,
  behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
    ? ('instant' as const)
    : ('smooth' as const),
})
function selectStep(index: number) {
  activeStep.value = index
  void nextTick(() => startSection.value?.scrollIntoView(scrollOptions()))
}
function stepKey(event: KeyboardEvent, index: number) {
  const target =
    event.key === 'ArrowRight'
      ? (index + 1) % 3
      : event.key === 'ArrowLeft'
        ? (index + 2) % 3
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? 2
            : -1
  if (target < 0) return
  event.preventDefault()
  selectStep(target)
  steps.value[target]?.focus()
}
function toolKey(event: KeyboardEvent, index: number) {
  const target = ['ArrowRight', 'ArrowDown'].includes(event.key)
    ? (index + 1) % mcpTools.length
    : ['ArrowLeft', 'ArrowUp'].includes(event.key)
      ? (index + mcpTools.length - 1) % mcpTools.length
      : event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? mcpTools.length - 1
          : -1
  if (target < 0) return
  event.preventDefault()
  activeTool.value = target
  toolButtons.value[target]?.focus()
}
function showTool(name: (typeof mcpTools)[number]['name']) {
  activeTool.value = mcpTools.findIndex((tool) => tool.name === name)
  void nextTick(() => toolSection.value?.scrollIntoView(scrollOptions()))
}
async function copy(value: string, name: string) {
  clearTimeout(timer)
  copied.value = ''
  copyError.value = ''
  try {
    await navigator.clipboard.writeText(value)
    copied.value = name
    timer = setTimeout(() => {
      copied.value = ''
    }, 2400)
  } catch {
    copyError.value = '复制未成功，请选中内容手动复制。'
  }
}
onScopeDispose(() => clearTimeout(timer))
</script>

<template>
  <div class="mcp-guide">
    <section class="mg-hero" aria-labelledby="mg-hero-title">
      <div class="mg-hero-copy">
        <span class="mg-badge">MODEL CONTEXT PROTOCOL</span>
        <h2 id="mg-hero-title">让 Agent 读懂，<br />项目里的接口。</h2>
        <p>
          浏览目录、搜索接口或顺着字段查来源。<br />由 Agent
          决定读取路线，逐步核对完整说明与真实依据。
        </p>
        <div class="mg-hero-actions">
          <RouterLink
            to="/settings/mcp"
            class="mg-primary mg-credential-link"
            aria-label="创建或管理 MCP 凭证"
          >
            <AppIcon name="lock" :size="15" mode="static" />创建 MCP 凭证
            <AppIcon name="arrow-right" :size="15" mode="static" />
          </RouterLink>
          <a href="#mcp-tools"
            >了解 {{ mcpTools.length }} 个工具<AppIcon
              name="arrow-right"
              :size="15"
              mode="static" /></a
          ><a href="#mcp-start"
            >查看接入准备<AppIcon name="chevron-down" :size="15" mode="static"
          /></a>
        </div>
      </div>
      <div class="mg-hero-route" aria-label="资料读取入口，按任务选择">
        <span>CHOOSE WHAT TO READ</span
        ><button type="button" @click="showTool('list_projects')">
          <span class="mg-route-index">01</span>
          <div><strong>发现可访问项目</strong><code>list_projects</code></div>
          <AppIcon name="arrow-up-right" :size="14" mode="static" /></button
        ><button type="button" @click="showTool('list_project_environments')">
          <span class="mg-route-index">02</span>
          <div><strong>选择项目环境</strong><code>list_project_environments</code></div>
          <AppIcon name="arrow-up-right" :size="14" mode="static" /></button
        ><button type="button" @click="showTool('browse_directory')">
          <span class="mg-route-index">03</span>
          <div><strong>按业务目录探索</strong><code>browse_directory</code></div>
          <AppIcon name="arrow-up-right" :size="14" mode="static" /></button
        ><button type="button" @click="showTool('read_interface')">
          <span class="mg-route-index">04</span>
          <div><strong>核对详情与来源</strong><code>read_interface</code></div>
          <AppIcon name="arrow-up-right" :size="14" mode="static" /></button
        ><button type="button" @click="showTool('read_request_material')">
          <span class="mg-route-index">05</span>
          <div><strong>读取请求资料</strong><code>read_request_material</code></div>
          <AppIcon name="arrow-up-right" :size="14" mode="static" /></button
        ><button type="button" @click="showTool('trace_dependencies')">
          <span class="mg-route-index">06</span>
          <div><strong>追踪输入来源</strong><code>trace_dependencies</code></div>
          <AppIcon name="arrow-up-right" :size="14" mode="static" /></button
        ><button type="button" @click="showTool('read_field_values')">
          <span class="mg-route-index">07</span>
          <div><strong>读取完整观测值</strong><code>read_field_values</code></div>
          <AppIcon name="arrow-up-right" :size="14" mode="static" /></button
        ><button class="mg-search-shortcut" type="button" @click="showTool('search_interfaces')">
          <AppIcon name="search" :size="13" mode="static" />知道接口或字段？直接搜索
        </button>
      </div>
    </section>
    <div class="mg-release">
      <span>{{ mcpRelease.label }}</span>
      <p>{{ mcpRelease.message }}</p>
    </div>
    <section id="mcp-install" class="mg-section" aria-labelledby="mg-install-title">
      <header class="mg-heading">
        <div>
          <span class="mg-eyebrow">START WITH A LINK</span>
          <h2 id="mg-install-title">让 Agent 帮你接入。</h2>
        </div>
        <a :href="links.referenceUrl" class="mg-text-button">无需脚本的完整参考</a>
      </header>
      <p class="mg-intro">
        把本文链接交给能配置本机客户端的
        Agent，开场已带入当前实例地址、资料结构的用途和自主检索原则。Agent
        先理解怎样利用这些结构，再完成接入；登录后创建独立 MCP Token，在客户端本地填写并验证读取。
      </p>
      <div class="mg-code">
        <header>
          <span>当前实例 · 地址已填写</span
          ><button type="button" @click="copy(installPrompt, 'install')">
            {{ copied === 'install' ? '已复制' : '复制开场' }}
          </button>
        </header>
        <pre tabindex="0"><code>{{ installPrompt }}</code></pre>
      </div>
      <ol class="mg-action-list">
        <li v-for="(step, i) in mcpInstallSteps" :key="step">
          <strong>0{{ i + 1 }}</strong>
          <p>{{ step }}</p>
        </li>
      </ol>
      <p class="mg-inline-note">
        <AppIcon name="circle-help" :size="16" mode="static" />127.0.0.1 只指向 Agent 所在机器。云端
        Agent 需要可访问的线上文档；/docs/mcp 是文档，不是 MCP 协议端点。
      </p>
    </section>

    <section id="mcp-start" ref="startSection" class="mg-section" aria-labelledby="mg-start-title">
      <header class="mg-heading">
        <div>
          <span class="mg-eyebrow">GET CONNECTED</span>
          <h2 id="mg-start-title">先有权限，再让 Agent 读取。</h2>
        </div>
        <RouterLink
          to="/settings/mcp"
          class="mg-primary mg-credential-link"
          aria-label="创建或管理 MCP 凭证"
        >
          <AppIcon name="lock" :size="15" mode="static" />创建 MCP 凭证
          <AppIcon name="arrow-right" :size="15" mode="static" />
        </RouterLink>
      </header>
      <div class="mg-steps" role="tablist" aria-label="MCP 接入步骤">
        <button
          v-for="(label, index) in stepLabels"
          :id="`mcp-step-${index}`"
          :key="label"
          :ref="
            (el) => {
              if (el) steps[index] = el as HTMLButtonElement
            }
          "
          type="button"
          role="tab"
          :aria-selected="activeStep === index"
          :aria-controls="`mcp-step-panel-${index}`"
          :tabindex="activeStep === index ? 0 : -1"
          @click="selectStep(index)"
          @keydown="stepKey($event, index)"
        >
          <span>0{{ index + 1 }}</span
          >{{ label }}
        </button>
      </div>
      <div
        id="mcp-step-panel-0"
        v-show="activeStep === 0"
        class="mg-step-panel"
        role="tabpanel"
        aria-labelledby="mcp-step-0"
        tabindex="0"
      >
        <div class="mg-token-layout">
          <div>
            <h3>创建属于你的 MCP 凭证。</h3>
            <p class="mg-intro">
              从头像菜单或顶部接口文档菜单进入 MCP 凭证，可创建多个 token，选择时间区间或无限期。
              每个凭证都遵循所属账号当前有效的项目权限。
            </p>
            <ol class="mg-action-list">
              <li>
                <strong>确认项目范围</strong>
                <p>Token 仅能访问获授权项目。填写一个 project_id 并不能扩大权限。</p>
              </li>
              <li>
                <strong>创建并保存专用凭证</strong>
                <p>完整 token 仅创建时展示一次；服务端只保存摘要，丢失后请撤销并新建。</p>
              </li>
              <li>
                <strong>在客户端本地填写</strong>
                <p>
                  使用客户端支持的凭据配置方式。本页只生成占位配置；缺少凭证时明确停在授权步骤。
                </p>
              </li>
            </ol>
          </div>
          <aside class="mg-token-card">
            <AppIcon name="lock" :size="25" mode="static" /><span>MCP TOKEN</span
            ><code>YOUR_MCP_TOKEN</code>
            <dl>
              <div>
                <dt>颁发方式</dt>
                <dd>当前账号自行创建、撤销</dd>
              </div>
              <div>
                <dt>授权粒度</dt>
                <dd>账号当前有效项目权限</dd>
              </div>
              <div>
                <dt>完整凭证</dt>
                <dd>仅创建时展示一次</dd>
              </div>
            </dl>
            <small>这是格式示意，不是可用 Token。</small>
          </aside>
        </div>
        <div class="mg-panel-footer">
          <span>以实际颁发的完整凭证为准；不猜测前缀。</span
          ><button type="button" class="mg-primary" @click="selectStep(1)">
            下一步 · 配置客户端<AppIcon name="arrow-right" :size="15" mode="static" />
          </button>
        </div>
      </div>
      <div
        id="mcp-step-panel-1"
        v-show="activeStep === 1"
        class="mg-step-panel"
        role="tabpanel"
        aria-labelledby="mcp-step-1"
        tabindex="0"
      >
        <div class="mg-config-heading">
          <h3>准备客户端配置模板。</h3>
          <span>Streamable HTTP · 配置示例</span>
        </div>
        <p class="mg-intro">
          使用支持 Streamable HTTP 和自定义 Header
          的客户端。部署方提供的地址可能带网关前缀；文档域名不一定是服务地址。当前不提供完整 OAuth
          自动发现流程。
        </p>
        <label class="mg-input-label" for="mcp-service-address"
          >MCP 服务地址 <span>已按当前环境填写，可修改</span></label
        ><input
          id="mcp-service-address"
          v-model="address"
          class="mg-url-input"
          type="url"
          autocomplete="off"
          spellcheck="false"
          :placeholder="links.serviceUrl"
          :aria-invalid="!!config.error"
          aria-describedby="mcp-config-help"
        />
        <p id="mcp-config-help" class="mg-input-help" :class="{ 'is-error': config.error }">
          {{
            config.error ||
            '地址与 MCP 凭证页使用同一 API 配置。只需在客户端替换 YOUR_MCP_TOKEN；本页不会读取你的登录 Token。'
          }}
        </p>
        <button
          v-if="address !== links.serviceUrl"
          type="button"
          class="mg-text-button"
          @click="address = links.serviceUrl"
        >
          使用当前环境地址
        </button>
        <div v-if="config.text" class="mg-code">
          <header>
            <span>mcpServers · 配置模板</span
            ><button type="button" @click="copy(config.text, 'config')">
              {{ copied === 'config' ? '已复制模板' : '复制配置模板' }}
            </button>
          </header>
          <pre tabindex="0"><code>{{ config.text }}</code></pre>
        </div>
        <p class="mg-inline-note">
          <AppIcon name="circle-help" :size="16" mode="static" />将
          <code>YOUR_MCP_TOKEN</code>
          留到客户端本地替换。不同客户端的配置位置，以该客户端说明为准。
        </p>
        <div class="mg-panel-footer">
          <button type="button" class="mg-text-button" @click="selectStep(0)">
            上一步 · 准备授权</button
          ><button type="button" class="mg-primary" @click="selectStep(2)">
            下一步 · 确认连接<AppIcon name="arrow-right" :size="15" mode="static" />
          </button>
        </div>
      </div>
      <div
        id="mcp-step-panel-2"
        v-show="activeStep === 2"
        class="mg-step-panel"
        role="tabpanel"
        aria-labelledby="mcp-step-2"
        tabindex="0"
      >
        <h3>看到“已连接”，还要再读一次。</h3>
        <p class="mg-intro">
          先确认实际工具列表，再用已授权项目做真实读取。下面仅记录你手动核对的状态，本页不会调用服务，勾选也不等于运行验证。
        </p>
        <div class="mg-checklist">
          <div>
            <strong>接入核对</strong
            ><span aria-live="polite">{{ checklist.length }} / {{ checkItems.length }}</span>
          </div>
          <label v-for="item in checkItems" :key="item"
            ><input v-model="checklist" type="checkbox" :value="item" /><span>{{
              item
            }}</span></label
          >
          <p v-if="checklist.length === checkItems.length" role="status">
            已记录全部手动核对项。请保留实际工具调用与读取结果，作为接入验证依据。
          </p>
        </div>
        <p class="mg-inline-note">
          <AppIcon
            name="circle-help"
            :size="16"
            mode="static"
          />权限拒绝、空工具列表与接口搜索为空是不同的问题。tools/list
          为空可能是服务未装配知识导航能力。
        </p>
        <div class="mg-panel-footer">
          <button type="button" class="mg-text-button" @click="selectStep(1)">
            上一步 · 配置客户端</button
          ><button type="button" class="mg-primary" @click="showTool('list_projects')">
            看看 {{ mcpTools.length }} 个工具怎么用<AppIcon
              name="arrow-right"
              :size="15"
              mode="static"
            />
          </button>
        </div>
      </div>
      <p class="mg-copy-feedback" role="status">
        {{ copyError || (copied ? '已复制到剪贴板。' : '') }}
      </p>
    </section>

    <section id="mcp-retrieval" class="mg-section" aria-labelledby="mg-retrieval-title">
      <header class="mg-heading">
        <div>
          <span class="mg-eyebrow">READ AS NEEDED</span>
          <h2 id="mg-retrieval-title">把查找接口资料交给 Agent。</h2>
        </div>
      </header>
      <p class="mg-intro">
        你只需说明哪个项目、哪个环境，以及想解决什么问题。{{ mcpPurpose.spirit }}
      </p>
      <p class="mg-intro">{{ mcpPurpose.benefit }}</p>
      <p class="mg-intro">{{ mcpPurpose.evidence }}</p>
      <p class="mg-intro">
        你不用提前查 ID，也不用安排工具调用顺序。下面是可以利用的入口，Agent
        按任务选择、交替使用，需要时继续展开。
      </p>
      <ol class="mg-action-list">
        <li v-for="(path, i) in mcpRetrievalPaths" :key="path.title">
          <strong>0{{ i + 1 }}</strong>
          <div>
            <h3>{{ path.title }}</h3>
            <p>{{ path.route }}</p>
            <p>{{ path.detail }}</p>
          </div>
        </li>
      </ol>
      <ul>
        <li v-for="rule in mcpReadingRules" :key="rule">{{ rule }}</li>
      </ul>
    </section>

    <section id="mcp-tools" ref="toolSection" class="mg-section" aria-labelledby="mg-tools-title">
      <header class="mg-heading">
        <div>
          <span class="mg-eyebrow">TOOL EXPLORER</span>
          <h2 id="mg-tools-title">{{ mcpTools.length }} 个只读工具，逐步取得依据。</h2>
        </div>
        <span class="mg-small-note">参数示例 · 不执行调用</span>
      </header>
      <div class="mg-tool-browser">
        <div class="mg-tool-tabs" role="tablist" aria-label="MCP 工具" aria-orientation="vertical">
          <button
            v-for="(item, index) in mcpTools"
            :id="`mcp-tool-${index}`"
            :key="item.name"
            :ref="
              (el) => {
                if (el) toolButtons[index] = el as HTMLButtonElement
              }
            "
            type="button"
            role="tab"
            :aria-selected="activeTool === index"
            aria-controls="mcp-tool-panel"
            :tabindex="activeTool === index ? 0 : -1"
            @click="activeTool = index"
            @keydown="toolKey($event, index)"
          >
            <small>0{{ index + 1 }}</small
            ><strong>{{ item.label }}</strong
            ><code>{{ item.name }}</code>
          </button>
        </div>
        <div
          id="mcp-tool-panel"
          class="mg-tool-content"
          role="tabpanel"
          :aria-labelledby="`mcp-tool-${activeTool}`"
          tabindex="0"
        >
          <h3>
            <code>{{ tool.name }}</code>
          </h3>
          <p class="mg-intro">{{ tool.description }}</p>
          <div class="mg-param-wrap">
            <table>
              <caption>
                输入参数
              </caption>
              <thead>
                <tr>
                  <th>参数</th>
                  <th>类型</th>
                  <th>说明</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="parameter in tool.parameters" :key="parameter.name">
                  <td>
                    <code>{{ parameter.name }}</code
                    ><small :class="{ required: parameter.required }">{{
                      parameter.required ? '必填' : '可选'
                    }}</small>
                  </td>
                  <td>{{ parameter.type }}</td>
                  <td>{{ parameter.detail }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div
            v-if="tool.name === 'search_interfaces'"
            class="mg-folder-switch"
            aria-label="接口列表参数示例"
          >
            <button type="button" :aria-pressed="!unplaced" @click="unplaced = false">
              路径关键词</button
            ><button type="button" :aria-pressed="unplaced" @click="unplaced = true">
              项目全部接口
            </button>
          </div>
          <div class="mg-code">
            <header>
              <span>arguments · 示例 ID</span
              ><button type="button" @click="copy(argumentsText, 'arguments')">
                {{ copied === 'arguments' ? '已复制参数' : '复制参数' }}
              </button>
            </header>
            <pre tabindex="0"><code>{{ argumentsText }}</code></pre>
          </div>
          <h4>返回哪些内容</h4>
          <dl class="mg-tool-returns">
            <div v-for="item in tool.returns" :key="item.field">
              <dt>
                <code>{{ item.field }}</code>
              </dt>
              <dd>{{ item.detail }}</dd>
            </div>
          </dl>
          <p class="mg-tool-tip">
            <AppIcon name="circle-help" :size="15" mode="static" />{{ tool.tip }}
          </p>
        </div>
      </div>
    </section>

    <section id="mcp-knowledge" class="mg-section" aria-labelledby="mg-knowledge-title">
      <header class="mg-heading">
        <div>
          <span class="mg-eyebrow">FACTS & KNOWLEDGE</span>
          <h2 id="mg-knowledge-title">一起读取，分清来源。</h2>
        </div>
      </header>
      <div class="mg-source-grid">
        <article>
          <span class="mg-source-tag">facts / 自动观测</span>
          <h3>实际看到了什么。</h3>
          <p>从已经采集到的流量中提取接口事实，保留可回看的调用依据。</p>
          <ul>
            <li>请求方法、路径与参数结构</li>
            <li>请求体、响应结构和调用示例</li>
            <li>调用次数与最近调用时间</li>
          </ul>
          <code>method · path_template · examples</code>
        </article>
        <article>
          <span class="mg-source-tag">knowledge / 人工 + LLM 整理</span>
          <h3>这些信息意味着什么。</h3>
          <p>在真实示例上补充业务语义，人工可以修订目录、说明和关联。</p>
          <ul>
            <li>接口名称、用途与目录位置</li>
            <li>字段的业务含义及取值说明</li>
            <li>已记录的关联类型与证据</li>
          </ul>
          <code>note · fields · links</code>
        </article>
      </div>
      <p class="mg-source-boundary">
        核对环境、来源身份与采集上下文。判断先后时比较来源
        <code>context.completed_at</code> 与目标 <code>context.started_at</code>，不能只看
        observed_at。同页面不一定同 view_id；样本对应不证明必调顺序，整理说明也不是新观测。
      </p>
    </section>

    <section id="mcp-scenarios" class="mg-section" aria-labelledby="mg-scenarios-title">
      <header class="mg-heading">
        <div>
          <span class="mg-eyebrow">ASK WITH CONTEXT</span>
          <h2 id="mg-scenarios-title">给 Agent 一个明确的阅读任务。</h2>
        </div>
      </header>
      <div class="mg-scenarios">
        <article v-for="(scenario, index) in scenarios" :key="scenario.title">
          <div class="mg-scenario-head">
            <span>0{{ index + 1 }}</span>
            <h3>{{ scenario.title }}</h3>
            <button type="button" @click="copy(scenario.prompt, `prompt-${index}`)">
              {{ copied === `prompt-${index}` ? '已复制' : '复制提问'
              }}<AppIcon
                :name="copied === `prompt-${index}` ? 'check' : 'panels'"
                :size="14"
                mode="static"
              />
            </button>
          </div>
          <p class="mg-scenario-route">{{ scenario.route }}</p>
          <p>{{ scenario.prompt }}</p>
        </article>
      </div>
      <p class="mg-small-note">
        {{
          activeProject.current.value
            ? `已带入当前项目名称「${activeProject.current.value.name}」。`
            : '项目和业务名称为示例，可替换成你实际想了解的名称。'
        }}Agent 会先查询有权限的项目和环境，取得实际 ID；同名时请你选择，无需手动查找 UUID。
      </p>
      <h3 class="mg-conversation-title">模拟：从任务 ID 查来源，再核实字典线索</h3>
      <p class="mg-intro">
        以下展示可以怎样继续追问，具体结果以你项目里保存的资料为准。Agent
        可以自行选择目录或搜索，找到线索后再展开依据和缺口，全程不发送业务请求。
      </p>
      <div class="mg-conversation">
        <article v-for="(turn, i) in mcpConversation" :key="turn.user">
          <span>第 {{ i + 1 }} 轮</span>
          <h4>用户</h4>
          <p>{{ turn.user }}</p>
          <h4>Agent 应执行</h4>
          <p>{{ turn.agent }}</p>
          <small>{{ turn.tools }}</small>
        </article>
      </div>
    </section>
    <section id="mcp-audit" class="mg-section" aria-labelledby="mg-audit-title">
      <header class="mg-heading">
        <div>
          <span class="mg-eyebrow">COVERAGE & EVIDENCE</span>
          <h2 id="mg-audit-title">资料能说明什么，还有哪些未知。</h2>
        </div>
      </header>
      <div class="mg-audit-grid">
        <article v-for="item in mcpCoverageCapabilities" :key="item.title">
          <span>{{ item.status }}</span>
          <h3>{{ item.title }}</h3>
          <p>{{ item.detail }}</p>
        </article>
      </div>
    </section>

    <section id="mcp-faq" class="mg-section" aria-labelledby="mg-faq-title">
      <header class="mg-heading">
        <div>
          <span class="mg-eyebrow">TROUBLESHOOTING</span>
          <h2 id="mg-faq-title">接入与使用中的常见问题。</h2>
        </div>
      </header>
      <details v-for="faq in mcpFaqs" :key="faq.question" class="mg-faq">
        <summary>
          {{ faq.question }}<AppIcon name="chevron-down" :size="16" mode="static" />
        </summary>
        <p>{{ faq.answer }}</p>
      </details>
    </section>
    <aside class="mg-related">
      <strong>先让资料进入项目，再让 Agent 使用。</strong>
      <div>
        <RouterLink to="/docs/fetcher"
          >Fetcher 使用教程<AppIcon name="arrow-up-right" :size="14" mode="static" /></RouterLink
        ><RouterLink to="/docs/api"
          >录入接口<AppIcon name="arrow-up-right" :size="14" mode="static"
        /></RouterLink>
      </div>
    </aside>
  </div>
</template>

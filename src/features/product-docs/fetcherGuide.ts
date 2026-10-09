export const fetcherSteps = [
  {
    id: 'install',
    label: '安装扩展',
    note: '下载并加载 ZIP',
    title: '先把 Fetcher 放进浏览器。',
    intro: '当前提供 Chrome 开发版。准备 Chrome 125 或更新版本，以及解压后的扩展文件夹。',
    image: 'welcome.png',
    imageAlt: 'Fetcher 欢迎界面，包含登录 NexoFolio 与配置服务两个入口',
    imageCaption: '打开侧边栏后，应看到这个欢迎界面。',
    actions: [
      {
        title: '下载并解压',
        text: '点击上方下载按钮，将 ZIP 解压到一个固定位置。加载后不要移动或删除这个文件夹。',
      },
      {
        title: '打开扩展管理页',
        text: '复制下面的地址，粘贴到 Chrome 地址栏并回车。打开右上角的「开发者模式」。',
      },
      {
        title: '加载已解压的扩展程序',
        text: '点击同名按钮，选择包含 manifest.json 的那一层文件夹，不是 ZIP 文件。',
      },
      {
        title: '打开 Fetcher',
        text: '在浏览器工具栏的扩展菜单中固定 NexoFolio Fetcher，再点击图标，打开侧边栏。',
      },
    ],
    success: '看到「登录 NexoFolio」与「配置 NexoFolio 服务」，就可以进入下一步。',
  },
  {
    id: 'connect',
    label: '连接服务',
    note: '配置地址并登录',
    title: '告诉 Fetcher，资料要送到哪里。',
    intro:
      '准备管理员提供的 NexoFolio 后端服务地址和登录账号。这里填写的不是正在采集的业务网站地址。',
    image: 'service.png',
    imageAlt: 'Fetcher 配置服务界面，展示服务名称、后端服务地址和保存服务按钮',
    imageCaption: '地址仅为示例，请替换为你实际使用的服务。',
    actions: [
      {
        title: '进入「配置 NexoFolio 服务」',
        text: '从欢迎页下方打开配置。服务名称可选填一个便于识别的名字。',
      },
      {
        title: '填写后端服务地址',
        text: '使用完整的 http:// 或 https:// 地址。若部署带有端口或路径，也要保留；不要添加页面参数或 # 片段。',
      },
      {
        title: '保存服务，再登录',
        text: '点击「保存服务」，按登录页提示填写团队账号和密码。如果 Chrome 请求服务访问权限，请核对地址后允许。',
      },
    ],
    success: '登录后，侧边栏开始读取当前业务页面的站点绑定信息。',
  },
  {
    id: 'bind',
    label: '绑定站点',
    note: '选定项目与环境',
    title: '把当前站点放进正确的项目。',
    intro: '先切换到你要采集的业务页面，并保持它为当前活动标签页。确认你有目标项目的访问权限。',
    image: 'binding.png',
    imageAlt: 'Fetcher 绑定完成后的信息卡，显示示例站点、订单服务示例项目与测试环境',
    imageCaption: '绑定完成后，核对这里的项目名称与环境。',
    actions: [
      {
        title: '未绑定时，点击「绑定此站点」',
        text: '选择整个站点或更具体的路径范围，再点击「授权并选择项目」，按 Chrome 提示允许访问。',
      },
      {
        title: '选择项目和环境',
        text: '选择目标项目，再选择已有环境或填写环境名称，最后点击「保存绑定」。更具体的路径绑定会优先匹配。',
      },
      {
        title: '已有绑定时，直接核对',
        text: '如果侧边栏已显示项目与环境，无需重复绑定；若出现「允许访问此站点」，完成访问授权即可。',
      },
    ],
    success: '信息卡显示正确的项目和环境；没有请求时出现「等待当前页面发出请求…」是正常的。',
  },
  {
    id: 'capture',
    label: '开始采集',
    note: '操作并确认记录',
    title: '照常操作页面，留下第一条记录。',
    intro: '登录、站点授权和绑定满足后，会自动监听当前活动页面。无需寻找「开始录制」按钮。',
    image: 'capture.png',
    imageAlt: 'Fetcher 最近捕获接口列表，展示演示 GET、POST、PUT 请求及 HTTP 状态码',
    imageCaption: '项目与请求均为演示数据；实际内容取决于你的业务页面。',
    actions: [
      {
        title: '在业务页面触发一次新请求',
        text: '例如查询列表、打开详情或切换分页。安装前已经发出的请求不会自动补采；必要时刷新页面后再操作。',
      },
      {
        title: '查看侧边栏里的接口列表',
        text: '新记录出现在顶部，显示请求方法、路径和响应状态。最近 20 条是界面展示范围，不是上传数量上限。',
      },
      {
        title: '确认上传，再回项目查看',
        text: '悬停记录查看上传状态，确认「已确认」。随后回到同一项目、同一环境查找接口记录；200 只代表业务响应成功。',
      },
    ],
    success: '看到新请求、上传已确认，并能在对应项目与环境找到记录，才算完成这次接入。',
  },
] as const

export const fetcherFaqs = [
  {
    question: '加载扩展时提示找不到 manifest.json？',
    answer:
      '先解压 ZIP，再选择直接包含 manifest.json 的文件夹。有些压缩包会多一层目录，需要再打开一层。加载成功后请保留这个目录；更新版本后，在扩展管理页重新加载扩展，再刷新业务页面。',
  },
  {
    question: '已经登录，为什么还是没有接口？',
    answer:
      '检查当前活动页面是否为普通 HTTP / HTTPS 业务网页，项目和环境是否正确，Chrome 是否已允许访问站点。然后在这个页面执行一次会产生新请求的操作。插件只监听页面内可捕获的 fetch / XHR，Chrome 内部页面不支持。',
  },
  {
    question: '请求显示 200，为什么项目里还没有记录？',
    answer:
      'HTTP 状态码属于业务接口，不等于 NexoFolio 已接收。请悬停该记录查看上传状态；如出现拒绝或暂停提示，按提示检查服务连通性、项目权限和环境归属，再回项目查找。',
  },
  {
    question: '绑定错了项目或环境怎么办？',
    answer:
      '打开侧边栏底部的头像菜单，选择「更换绑定项目」或「更换环境」；同一域名的不同业务路径可用「为当前路径单独绑定」。绑定保存在 NexoFolio 服务端，更具体的路径优先匹配。',
  },
  {
    question: '关闭侧边栏还会采集吗？',
    answer:
      '会。采集由扩展后台负责，不依赖侧边栏是否打开。离开授权范围、切走活动页面、退出登录或失去权限后，会停止新增采集。关闭侧边栏不等于停止采集。',
  },
  {
    question: '所有请求和响应内容都能完整保存吗？',
    answer:
      '不是完整网络录制。注入前的请求、部分 Worker 请求、不可读响应和文件字节不保证覆盖；正文有读取上限与超时限制。不完整的数据会带有相应标记，阅读时需要保留这些限制。',
  },
] as const

// Search indexes the same instructions that the interactive guide displays.
export const fetcherGuideSearchText =
  fetcherSteps
    .map(
      (step) =>
        `## ${step.label}\n\n${step.intro}\n\n${step.actions.map((action) => `${action.title}：${action.text}`).join('\n\n')}\n\n完成标志：${step.success}`,
    )
    .join('\n\n') +
  '\n\n' +
  fetcherFaqs.map((faq) => `## ${faq.question}\n\n${faq.answer}`).join('\n\n')

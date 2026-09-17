import { createApp, nextTick } from 'vue'
import { pinia } from './app/pinia'
import App from './app/App.vue'
import { router } from './app/router'
import { projectIdForDocumentLoad, projectRefreshLoading } from './app/projectRefreshLoading'
import { useNavigationTransition } from './stores/navigationTransition'
import './styles/tokens.css'
import './styles/base.css'
import './components/motion/modal.css'

const app = createApp(App)
app.use(pinia)
const initialRoute = router.resolve(router.options.history.location)
const refreshProjectId = projectIdForDocumentLoad(initialRoute.path)
let pageMounted: (() => void) | undefined
let cancelRefresh: (() => void) | undefined
if (refreshProjectId) {
  const transition = useNavigationTransition(pinia)
  const runId = transition.start('正在载入项目知识', undefined, 2000)
  pageMounted = projectRefreshLoading.start(refreshProjectId, () => transition.settle(runId))
  const removeAfterEach = router.afterEach((to, _from, failure) => {
    if (failure || to.fullPath !== initialRoute.fullPath) cancelRefresh?.()
  })
  const removeError = router.onError(() => cancelRefresh?.())
  cancelRefresh = () => {
    projectRefreshLoading.cancel()
    transition.finish(runId)
    removeAfterEach()
    removeError()
  }
}
app.use(router)
if (refreshProjectId) {
  // Show the overlay while authentication and lazy route imports are still pending.
  app.mount('#app')
  void router.isReady().then(
    async () => {
      await nextTick()
      pageMounted?.()
    },
    () => cancelRefresh?.(),
  )
} else {
  void router.isReady().then(() => app.mount('#app'))
}

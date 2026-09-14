import type { IconName } from '@/components/icons/registry'

export interface NavigationItem {
  label: string
  description: string
  to: string
  icon: IconName
  keywords: string
}

export const navigation: NavigationItem[] = [
  {
    label: '项目空间',
    description: '按项目组织你的接口知识',
    to: '/projects',
    icon: 'folder',
    keywords: 'project workspace xiangmu',
  },
  {
    label: '接口目录',
    description: '浏览接口与关联的业务知识',
    to: '/interfaces',
    icon: 'network',
    keywords: 'api interface mulu',
  },
  {
    label: '偏好设置',
    description: '让工作空间更适合你',
    to: '/settings',
    icon: 'settings',
    keywords: 'theme appearance shezhi',
  },
]

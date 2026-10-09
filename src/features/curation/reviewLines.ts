import type { EndpointNote, FieldNote, Folder } from '@/contracts/knowledge/types'
import type { KnowledgeChange } from './changes'
import type { Candidate, KnowledgeLink } from './types'
export interface ReviewLine {
  label: string
  values: string[]
  code?: boolean
  subtle?: boolean
}
const grade: Record<string, string> = {
  candidate: '推断，业务含义待确认',
  observed: '样本中已观测',
  direct: '直接来源',
  confirmed: '已明确确认',
}
export function reviewLines(
  change: KnowledgeChange,
  value: unknown,
  candidate: Candidate,
): ReviewLine[] {
  if (!value) return []
  const lines: ReviewLine[] = []
  const add = (
    label: string,
    text: string | null | undefined | string[],
    code = false,
    subtle = false,
  ) => {
    const values = Array.isArray(text) ? text.filter(Boolean) : text ? [text] : []
    if (values.length) lines.push({ label, values, code, subtle })
  }
  switch (change.section) {
    case 'folders': {
      const folder = value as Folder
      add('目录名称', folder.name)
      add('简介', folder.summary)
      add(
        '上级目录',
        folder.parent
          ? [...candidate.base.folders, ...candidate.view.folders].find(
              (f) => f.id === folder.parent,
            )?.name || folder.parent
          : '项目根目录',
      )
      break
    }
    case 'placements': {
      const placement = value as { folder: string }
      const folders = new Map(
        [...candidate.base.folders, ...candidate.view.folders].map((f) => [f.id, f]),
      )
      const leaf = folders.get(placement.folder)
      add(
        '目录归属',
        [leaf?.parent ? (folders.get(leaf.parent)?.name ?? '') : '', leaf?.name || placement.folder]
          .filter(Boolean)
          .join(' / '),
      )
      break
    }
    case 'notes': {
      const note = value as EndpointNote
      add('接口名称', note.name)
      add('用途', note.purpose)
      add('详细说明', note.context?.description)
      add('待确认', note.context?.unknowns ?? [], false, true)
      break
    }
    case 'fields': {
      const note = value as FieldNote
      add('中文显示名', note.context?.display_name)
      add('字段说明', note.text)
      add('确认程度', grade[note.context?.meaning?.confirmation ?? 'candidate'])
      add('单位', note.context?.meaning?.unit)
      add('详细补充', note.context?.meaning?.details ?? [])
      if (note.context?.structure) {
        add('观测类型', note.context.structure.types.join(' | '), true)
        add('真实父级', note.context.structure.parent || '报文根节点', true)
        add('同级字段', note.context.structure.siblings, true)
      }
      add('待确认', note.context?.meaning?.unknowns ?? [], false, true)
      add('观测值（非完整枚举）', note.values, true)
      add(
        '依据',
        note.context?.evidence.map(
          (e) =>
            `${{ inference: '推断', observation: '观测', direct_source: '直接来源', related_interface: '关联接口' }[e.kind]} · ${e.text}`,
        ) ?? [],
        false,
        true,
      )
      break
    }
    case 'links': {
      const link = value as KnowledgeLink
      add(
        '关系类型',
        {
          parameter_source: '参数取值来源',
          entity_reference: '实体关联',
          authentication_use: '认证使用',
          confirmed_prerequisite: '已确认前置条件',
          conditional_prerequisite: '条件前置',
          recommended_check: '建议检查',
          list_to_detail: '列表到详情',
          dictionary: '字典来源',
          enum_subset: '观测选项对应',
          precondition: '参数传递',
        }[link.relation] || link.relation,
      )
      add('字段传递', `${link.from_field || '接口'} → ${link.to_field || '接口'}`, true)
      add('依据', link.evidence)
      add('确认程度', grade[link.context?.confirmation ?? 'candidate'])
      add('适用范围', link.context?.scope)
      add('条件', link.context?.condition)
      add(
        '来源',
        link.context?.sources?.map(
          (s) => `${s.page || '采集样本'}${s.pointer ? ' · ' + s.pointer : ''}`,
        ) ?? [],
        false,
        true,
      )
      break
    }
  }
  return lines
}

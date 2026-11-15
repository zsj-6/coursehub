<script setup lang="ts">
/**
 * 知识图谱（手写 SVG）：按前置关系分层，从左到右排列。
 * 颜色只表达掌握度三档（未学 / 薄弱 / 已掌握，中间为学习中）；也可以切换成按节点类型着色。
 */
import { computed } from 'vue'
import type { KEdge, KNode, NodeType } from '@/mock/ai'
import { masteryLevel } from '@/stores/ai'

const props = defineProps<{
  nodes: KNode[]
  edges: KEdge[]
  masteryOf: (id: string) => number | null
  selected?: string
  path?: string[]
  pending?: string[]
  colorBy?: 'mastery' | 'type'
  /** 只显示前 N 个节点（AI 生成动画用） */
  reveal?: number
}>()
const emit = defineEmits<{ select: [id: string] }>()

const COL_W = 168
const ROW_H = 82
const PAD_X = 70
const PAD_Y = 46
const R = 20

const layout = computed(() => {
  const ids = props.nodes.map((n) => n.id)
  const parents = new Map<string, string[]>()
  for (const e of props.edges) (parents.get(e.to) ?? parents.set(e.to, []).get(e.to)!).push(e.from)
  const depth = new Map<string, number>()
  const calc = (id: string, stack: Set<string>): number => {
    if (depth.has(id)) return depth.get(id)!
    if (stack.has(id)) return 0
    stack.add(id)
    const d = Math.max(-1, ...(parents.get(id) ?? []).map((p) => calc(p, stack))) + 1
    stack.delete(id)
    depth.set(id, d)
    return d
  }
  ids.forEach((id) => calc(id, new Set()))
  const layers: string[][] = []
  for (const id of ids) (layers[depth.get(id)!] ??= []).push(id)
  const maxRows = Math.max(1, ...layers.map((l) => l?.length ?? 0))
  const pos = new Map<string, { x: number; y: number }>()
  layers.forEach((layer, li) => {
    if (!layer) return
    if (li > 0) {
      const bary = (id: string) => {
        const ps = (parents.get(id) ?? []).map((p) => pos.get(p)?.y).filter((v): v is number => v !== undefined)
        return ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : Infinity
      }
      layer.sort((a, b) => bary(a) - bary(b))
    }
    const offset = ((maxRows - layer.length) * ROW_H) / 2
    layer.forEach((id, i) => pos.set(id, { x: PAD_X + li * COL_W, y: PAD_Y + offset + i * ROW_H }))
  })
  return {
    pos,
    width: PAD_X * 2 + (layers.length - 1) * COL_W,
    height: PAD_Y * 2 + (maxRows - 1) * ROW_H + 18,
  }
})

const visible = computed(() => {
  const n = props.reveal ?? props.nodes.length
  return new Set(props.nodes.slice(0, n).map((x) => x.id))
})
const pathSet = computed(() => new Set(props.path ?? []))
const pathActive = computed(() => (props.path?.length ?? 0) > 0)
const pathEdges = computed(() => {
  const set = new Set<string>()
  const p = props.path ?? []
  for (const e of props.edges) if (pathSet.value.has(e.from) && pathSet.value.has(e.to)) set.add(`${e.from}>${e.to}`)
  return p.length ? set : new Set<string>()
})
const pendingSet = computed(() => new Set(props.pending ?? []))

const TYPE_FILL: Record<NodeType, string> = {
  core: 'var(--ch-blue)',
  skill: 'var(--ch-purple)',
  apply: 'var(--ch-primary)',
  prereq: 'var(--ch-warning)',
}

function nodeStyle(n: KNode) {
  if (pendingSet.value.has(n.id)) return { fill: '#fff', stroke: 'var(--ch-purple)', text: 'var(--ch-purple)', dash: '4 3' }
  if (props.colorBy === 'type') return { fill: TYPE_FILL[n.type], stroke: TYPE_FILL[n.type], text: '#fff', dash: '' }
  const lv = masteryLevel(props.masteryOf(n.id))
  if (lv === 'good') return { fill: 'var(--ch-success)', stroke: 'var(--ch-success)', text: '#fff', dash: '' }
  if (lv === 'weak') return { fill: 'var(--el-color-warning-light-9)', stroke: 'var(--ch-warning)', text: 'var(--el-color-warning-dark-2)', dash: '' }
  if (lv === 'mid') return { fill: 'var(--ch-primary-bg)', stroke: 'var(--ch-primary)', text: 'var(--ch-primary-text)', dash: '' }
  return { fill: '#fff', stroke: '#c5c9ce', text: 'var(--ch-text-3)', dash: '3 3' }
}
function label(n: KNode) {
  if (pendingSet.value.has(n.id)) return 'AI'
  const m = props.masteryOf(n.id)
  return m === null ? '—' : String(m)
}
function edgePath(e: KEdge) {
  const a = layout.value.pos.get(e.from)
  const b = layout.value.pos.get(e.to)
  if (!a || !b) return ''
  const x1 = a.x + R
  const x2 = b.x - R - 4
  const mx = (x1 + x2) / 2
  return `M${x1},${a.y} C${mx},${a.y} ${mx},${b.y} ${x2},${b.y}`
}
const dim = (id: string) => pathActive.value && !pathSet.value.has(id)
</script>

<template>
  <div class="kg-wrap">
    <svg :viewBox="`0 0 ${layout.width} ${layout.height}`" :width="layout.width" :height="layout.height" class="kg">
      <defs>
        <marker id="kg-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="#c5c9ce" />
        </marker>
        <marker id="kg-arrow-on" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--ch-primary)" />
        </marker>
      </defs>
      <g v-for="e in edges" :key="`${e.from}>${e.to}`">
        <path
          v-if="visible.has(e.from) && visible.has(e.to)"
          :d="edgePath(e)"
          class="edge"
          :class="{ on: pathEdges.has(`${e.from}>${e.to}`), dim: pathActive && !pathEdges.has(`${e.from}>${e.to}`), dashed: e.rel === 'advance' }"
          :marker-end="pathEdges.has(`${e.from}>${e.to}`) ? 'url(#kg-arrow-on)' : 'url(#kg-arrow)'"
        />
      </g>
      <g
        v-for="n in nodes"
        v-show="visible.has(n.id)"
        :key="n.id"
        class="node"
        :class="{ dim: dim(n.id), sel: selected === n.id }"
        :transform="`translate(${layout.pos.get(n.id)?.x ?? 0}, ${layout.pos.get(n.id)?.y ?? 0})`"
        @click="emit('select', n.id)"
      >
        <circle v-if="selected === n.id" :r="R + 6" class="sel-ring" />
        <circle v-else-if="pathSet.has(n.id)" :r="R + 5" class="path-ring" />
        <circle v-if="(n.courses?.length ?? 0) >= 2" :r="R + 3" class="multi" />
        <circle :r="R" :fill="nodeStyle(n).fill" :stroke="nodeStyle(n).stroke" :stroke-dasharray="nodeStyle(n).dash" stroke-width="1.5" />
        <text y="4" text-anchor="middle" class="num" :fill="nodeStyle(n).text">{{ label(n) }}</text>
        <text :y="R + 16" text-anchor="middle" class="name">{{ n.name }}</text>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.kg-wrap {
  overflow-x: auto;
}
.kg {
  display: block;
  margin: 0 auto;
}
.edge {
  fill: none;
  stroke: #d3d6db;
  stroke-width: 1.3;
  transition: opacity 0.2s;
}
.edge.dashed {
  stroke-dasharray: 4 3;
}
.edge.on {
  stroke: var(--ch-primary);
  stroke-width: 2.2;
}
.edge.dim {
  opacity: 0.35;
}
.node {
  cursor: pointer;
  transition: opacity 0.2s;
}
.node.dim {
  opacity: 0.3;
}
.node:hover .name {
  fill: var(--ch-primary-text);
}
.num {
  font-size: 11px;
  font-weight: 600;
}
.name {
  font-size: 12px;
  font-weight: 500;
  fill: var(--ch-text);
}
.sel-ring {
  fill: none;
  stroke: var(--ch-text);
  stroke-width: 1.5;
}
.path-ring {
  fill: none;
  stroke: var(--ch-primary);
  stroke-width: 2;
}
.multi {
  fill: none;
  stroke: var(--ch-border);
  stroke-width: 1;
}
</style>

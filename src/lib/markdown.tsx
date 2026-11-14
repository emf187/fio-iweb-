import type { ReactNode } from 'react'

/**
 * Minimal markdown renderer for AI answers and notes. Renders structure
 * (headings, bold, italic, code, lists, links, blockquote) as styled elements
 * so no raw markdown characters ever appear on screen.
 */

function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = []
  const pattern =
    /(\*\*|__)(.+?)\1|(\*|_)([^*_]+?)\3|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const key = `${keyBase}-${i++}`
    if (m[2] !== undefined) out.push(<strong key={key}>{m[2]}</strong>)
    else if (m[4] !== undefined) out.push(<em key={key}>{m[4]}</em>)
    else if (m[5] !== undefined) out.push(<code key={key} className="md-code">{m[5]}</code>)
    else if (m[6] !== undefined && m[7] !== undefined) {
      out.push(
        <a key={key} href={m[7]} target="_blank" rel="noreferrer" className="md-link">
          {m[6]}
        </a>
      )
    }
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

export function renderMarkdown(src: string): ReactNode[] {
  const lines = src.replace(/\r\n/g, '\n').split('\n')
  const blocks: ReactNode[] = []
  let list: string[] = []
  let ordered = false
  let para: string[] = []
  let codeLines: string[] | null = null

  const flushList = () => {
    if (!list.length) return
    const items = list.map((item, i) => <li key={i}>{inline(item, `li-${blocks.length}-${i}`)}</li>)
    blocks.push(
      ordered ? <ol key={blocks.length}>{items}</ol> : <ul key={blocks.length}>{items}</ul>
    )
    list = []
  }
  const flushPara = () => {
    if (!para.length) return
    blocks.push(<p key={blocks.length}>{inline(para.join(' '), `p-${blocks.length}`)}</p>)
    para = []
  }

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      if (codeLines === null) {
        flushPara(); flushList()
        codeLines = []
      } else {
        blocks.push(
          <pre key={blocks.length} className="md-pre">
            <code>{codeLines.join('\n')}</code>
          </pre>
        )
        codeLines = null
      }
      continue
    }
    if (codeLines !== null) {
      codeLines.push(line)
      continue
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(line)
    if (heading) {
      flushPara(); flushList()
      const level = heading[1].length
      const Tag = (['h1', 'h2', 'h3', 'h4'] as const)[level - 1]
      blocks.push(<Tag key={blocks.length} className={`md-h md-h${level}`}>{inline(heading[2], `h-${blocks.length}`)}</Tag>)
      continue
    }
    const ul = /^\s*[-*•]\s+(.*)$/.exec(line)
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line)
    if (ul) {
      flushPara()
      if (ordered && list.length) flushList()
      ordered = false
      list.push(ul[1])
      continue
    }
    if (ol) {
      flushPara()
      if (!ordered && list.length) flushList()
      ordered = true
      list.push(ol[1])
      continue
    }
    if (/^\s*>\s?/.test(line)) {
      flushPara(); flushList()
      blocks.push(
        <blockquote key={blocks.length} className="md-quote">
          {inline(line.replace(/^\s*>\s?/, ''), `q-${blocks.length}`)}
        </blockquote>
      )
      continue
    }
    if (line.trim() === '') {
      flushPara(); flushList()
      continue
    }
    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      flushPara(); flushList()
      blocks.push(<hr key={blocks.length} className="md-hr" />)
      continue
    }
    flushList()
    para.push(line.trim())
  }
  flushPara(); flushList()
  if (codeLines !== null && codeLines.length) {
    blocks.push(
      <pre key={blocks.length} className="md-pre">
        <code>{codeLines.join('\n')}</code>
      </pre>
    )
  }
  return blocks
}

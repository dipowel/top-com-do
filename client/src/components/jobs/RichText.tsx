import { type ReactNode, createElement, Fragment } from 'react';
import { sanitizeRichText } from '@shared/sanitize';

/**
 * Renderiza texto de empleo (posiblemente con formato de un feed) como nodos React.
 * NUNCA usa `dangerouslySetInnerHTML`: sanea con la lista blanca de `shared/sanitize`
 * y luego recorre el árbol emitiendo SOLO etiquetas conocidas. Cualquier otra cosa
 * se degrada a su texto.
 */
const TAG_MAP: Record<string, keyof JSX.IntrinsicElements> = {
  P: 'p',
  BR: 'br',
  UL: 'ul',
  OL: 'ol',
  LI: 'li',
  STRONG: 'strong',
  B: 'strong',
  EM: 'em',
  I: 'em',
  H3: 'h4',
  H4: 'h4',
  A: 'a',
};

function toNodes(node: Node, key: number): ReactNode {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  const el = node as Element;
  const tag = TAG_MAP[el.tagName];
  const children = Array.from(el.childNodes).map((c, i) => toNodes(c, i));
  if (!tag) return createElement(Fragment, { key }, ...children);
  if (tag === 'br') return createElement('br', { key });
  if (tag === 'a') {
    const href = el.getAttribute('href') || '';
    const safe = /^(https?:|mailto:|tel:)/i.test(href) ? href : undefined;
    return createElement(
      'a',
      { key, href: safe, rel: 'nofollow noopener noreferrer', target: safe ? '_blank' : undefined, className: 'text-gold underline' },
      ...children,
    );
  }
  return createElement(tag, { key }, ...children);
}

export default function RichText({ html, className }: { html: string | null | undefined; className?: string }) {
  const clean = sanitizeRichText(html);
  if (!clean) return null;

  // Sin etiquetas → respetar los saltos de línea del texto plano.
  if (!/<[a-z]/i.test(clean)) {
    return <div className={`${className ?? ''} whitespace-pre-wrap`}>{clean}</div>;
  }

  let nodes: ReactNode = clean;
  if (typeof window !== 'undefined' && 'DOMParser' in window) {
    try {
      const doc = new DOMParser().parseFromString(`<body>${clean}</body>`, 'text/html');
      nodes = Array.from(doc.body.childNodes).map((c, i) => toNodes(c, i));
    } catch {
      nodes = clean.replace(/<[^>]+>/g, ' ');
    }
  } else {
    nodes = clean.replace(/<[^>]+>/g, ' ');
  }
  return <div className={`${className ?? ''} space-y-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5`}>{nodes}</div>;
}

/**
 * Saneado de contenido externo (descripciones, títulos, empresas de feeds/ATS).
 * Puro, sin DOM: lo usan el servidor (al importar) y el cliente (al renderizar).
 *
 * Regla de oro: NUNCA se hace `dangerouslySetInnerHTML` con esto. `sanitizeRichText`
 * produce una cadena con una lista blanca mínima de etiquetas; el componente
 * `RichText` del cliente la convierte a nodos React entendiendo SOLO esas etiquetas
 * (defensa en profundidad).
 */

const BLOCK_ELEMENTS =
  /<(script|style|iframe|object|embed|svg|math|form|input|button|link|meta|base)[\s\S]*?<\/\1\s*>/gi;
const SELF_CLOSING_DANGER =
  /<(script|style|iframe|object|embed|svg|math|form|input|button|link|meta|base)\b[^>]*\/?>/gi;
const COMMENTS = /<!--[\s\S]*?-->/g;
// Controles (salvo \t \n \r), zero-width y BOM. Se construye con `new RegExp` para
// que el archivo fuente no contenga caracteres de control literales.
const JUNK_CHARS = new RegExp(
  '[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F\\u200B-\\u200D\\uFEFF]',
  'g',
);

/** Etiquetas permitidas en texto enriquecido importado. */
export const RICH_TEXT_ALLOWED = [
  'p',
  'br',
  'ul',
  'ol',
  'li',
  'strong',
  'em',
  'b',
  'i',
  'h3',
  'h4',
  'a',
] as const;

const ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&mdash;': '—',
  '&ndash;': '–',
  '&hellip;': '…',
};

export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, d) => {
      const code = Number(d);
      return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : '';
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => {
      const code = parseInt(h, 16);
      return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : '';
    })
    .replace(/&[a-z]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? m);
}

/** Texto plano: sin etiquetas, entidades decodificadas, espacios colapsados. */
export function sanitizePlainText(input: string | null | undefined): string {
  if (!input) return '';
  return decodeEntities(
    String(input)
      .replace(BLOCK_ELEMENTS, ' ')
      .replace(SELF_CLOSING_DANGER, ' ')
      .replace(COMMENTS, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(JUNK_CHARS, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** ¿Es una URL segura para navegar o enlazar? Solo http(s) absolutas. */
export function isSafeUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /^https?:\/\/[^\s"'<>]+$/i.test(url.trim());
}

/** Como `isSafeUrl` pero además admite `mailto:` y `tel:`. */
export function isSafeContactUrl(url: string | null | undefined): boolean {
  if (isSafeUrl(url)) return true;
  const u = (url || '').trim();
  return /^(mailto:[^\s"'<>]+|tel:\+?[0-9()\-\s]+)$/i.test(u);
}

/**
 * Texto enriquecido con lista blanca mínima. Elimina bloques peligrosos, comentarios,
 * TODOS los atributos salvo `href` en `<a>` (validado), y cualquier etiqueta fuera de
 * `RICH_TEXT_ALLOWED` (conservando su texto interior).
 */
export function sanitizeRichText(input: string | null | undefined): string {
  if (!input) return '';
  let html = String(input)
    .replace(BLOCK_ELEMENTS, ' ')
    .replace(SELF_CLOSING_DANGER, ' ')
    .replace(COMMENTS, ' ')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*("javascript:[^"]*"|'javascript:[^']*'|javascript:[^\s>]+)/gi, '');

  const allowed = new Set<string>(RICH_TEXT_ALLOWED);
  html = html.replace(
    /<(\/?)([a-z0-9]+)((?:[^>"']|"[^"]*"|'[^']*')*)>/gi,
    (_m, close: string, tag: string, attrs: string) => {
      const name = tag.toLowerCase();
      if (!allowed.has(name)) return '';
      if (close) return `</${name}>`;
      if (name === 'a') {
        const href = /href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
        const raw = href ? (href[2] ?? href[3] ?? href[4] ?? '') : '';
        const val = decodeEntities(raw).trim();
        return isSafeContactUrl(val)
          ? `<a href="${val.replace(/"/g, '&quot;')}" rel="nofollow noopener noreferrer" target="_blank">`
          : '<a>';
      }
      return `<${name}>`;
    },
  );

  return html
    .replace(JUNK_CHARS, '')
    .replace(/(\s*<br>\s*){3,}/gi, '<br><br>')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

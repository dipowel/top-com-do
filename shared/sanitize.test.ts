import { describe, it, expect } from 'vitest';
import { sanitizePlainText, sanitizeRichText, isSafeUrl, isSafeContactUrl } from './sanitize';

describe('sanitize · sanitizePlainText', () => {
  it('quita etiquetas, decodifica entidades y colapsa espacios', () => {
    expect(sanitizePlainText('  <b>Hola</b>&nbsp; mundo &amp; co  ')).toBe('Hola mundo & co');
  });
  it('elimina zero-width y controles', () => {
    expect(sanitizePlainText('a​bc')).toBe('abc');
  });
  it('neutraliza <script>', () => {
    expect(sanitizePlainText('hola <script>alert(1)</script> mundo')).toBe('hola mundo');
  });
});

describe('sanitize · sanitizeRichText', () => {
  it('conserva la lista blanca y descarta el resto', () => {
    const out = sanitizeRichText('<p>Uno</p><ul><li>a</li><li>b</li></ul><div><span>x</span></div>');
    expect(out).toContain('<p>');
    expect(out).toContain('<ul>');
    expect(out).toContain('<li>');
    expect(out).not.toContain('<div>');
    expect(out).not.toContain('<span>');
  });

  it('elimina scripts, iframes y handlers on*', () => {
    const out = sanitizeRichText('<p onclick="x()">hi</p><script>bad()</script><iframe src="x"></iframe>');
    expect(out).not.toMatch(/script|iframe|onclick/i);
    expect(out).toContain('hi');
  });

  it('neutraliza href javascript: y conserva https con rel/target', () => {
    const bad = sanitizeRichText('<a href="javascript:alert(1)">x</a>');
    expect(bad).toContain('<a>');
    expect(bad).not.toMatch(/javascript:/i);
    const ok = sanitizeRichText('<a href="https://ejemplo.com">x</a>');
    expect(ok).toContain('href="https://ejemplo.com"');
    expect(ok).toContain('rel="nofollow noopener noreferrer"');
  });
});

describe('sanitize · URLs', () => {
  it('isSafeUrl solo acepta http(s) absolutas', () => {
    expect(isSafeUrl('https://a.com/x')).toBe(true);
    expect(isSafeUrl('http://a.com')).toBe(true);
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeUrl('data:text/html,x')).toBe(false);
    expect(isSafeUrl('/ruta/relativa')).toBe(false);
    expect(isSafeUrl(null)).toBe(false);
  });
  it('isSafeContactUrl añade mailto y tel', () => {
    expect(isSafeContactUrl('mailto:rrhh@empresa.com')).toBe(true);
    expect(isSafeContactUrl('tel:+18095551234')).toBe(true);
    expect(isSafeContactUrl('javascript:x')).toBe(false);
  });
});

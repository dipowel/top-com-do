import { useEffect } from 'react';
import type { SeoData } from '@shared/seo';

/**
 * Aplica título, meta descripción, canónico, Open Graph/Twitter y bloques
 * JSON-LD al `<head>` según la página actual. Marca sus nodos con `data-seo`
 * y, al desmontarse, restaura los valores por defecto de `index.html`.
 * No añade dependencias (react-helmet no está instalado).
 */

interface Defaults {
  title: string;
  description: string;
  canonical: string;
  image: string;
}

let DEFAULTS: Defaults | null = null;

function captureDefaults(): Defaults {
  if (DEFAULTS) return DEFAULTS;
  const get = (sel: string, attr: string) =>
    document.head.querySelector(sel)?.getAttribute(attr) ?? '';
  DEFAULTS = {
    title: document.title,
    description: get('meta[name="description"]', 'content'),
    canonical: get('link[rel="canonical"]', 'href'),
    image: get('meta[property="og:image"]', 'content'),
  };
  return DEFAULTS;
}

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  if (!content) return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setLink(rel: string, href: string) {
  if (!href) return;
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function apply(d: { title: string; description: string; canonical: string; image: string }) {
  if (d.title) {
    document.title = d.title;
    setMeta('property', 'og:title', d.title);
    setMeta('name', 'twitter:title', d.title);
  }
  if (d.description) {
    setMeta('name', 'description', d.description);
    setMeta('property', 'og:description', d.description);
    setMeta('name', 'twitter:description', d.description);
  }
  if (d.canonical) {
    setLink('canonical', d.canonical);
    setMeta('property', 'og:url', d.canonical);
  }
  if (d.image) {
    setMeta('property', 'og:image', d.image);
    setMeta('name', 'twitter:image', d.image);
  }
}

function clearJsonLd() {
  document.head.querySelectorAll('script[data-seo="1"]').forEach((n) => n.remove());
}

export function useSeo(data: SeoData | null | undefined) {
  const key = data
    ? JSON.stringify([data.title, data.description, data.canonical, data.image, data.jsonLd])
    : '';

  useEffect(() => {
    if (typeof document === 'undefined' || !data) return;
    const defaults = captureDefaults();

    apply({
      title: data.title,
      description: data.description,
      canonical: data.canonical,
      image: data.image || defaults.image,
    });

    clearJsonLd();
    for (const obj of data.jsonLd ?? []) {
      const s = document.createElement('script');
      s.type = 'application/ld+json';
      s.setAttribute('data-seo', '1');
      s.textContent = JSON.stringify(obj);
      document.head.appendChild(s);
    }

    return () => {
      clearJsonLd();
      apply(defaults);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

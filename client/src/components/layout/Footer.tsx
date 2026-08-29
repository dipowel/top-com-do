import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { CATEGORY_DEFS } from '@shared/categories';
import { SOCIAL_LINKS } from '@shared/site';
import { cleanName } from '@shared/seo';

const ICONS: Record<string, ReactElement> = {
  Instagram: (
    <path d="M12 2.2c3.2 0 3.6 0 4.9.07 1.2.06 1.8.25 2.2.42.6.22 1 .48 1.4.9.42.4.68.8.9 1.4.17.4.36 1 .42 2.2.07 1.3.07 1.7.07 4.9s0 3.6-.07 4.9c-.06 1.2-.25 1.8-.42 2.2-.22.6-.48 1-.9 1.4-.4.42-.8.68-1.4.9-.4.17-1 .36-2.2.42-1.3.07-1.7.07-4.9.07s-3.6 0-4.9-.07c-1.2-.06-1.8-.25-2.2-.42-.6-.22-1-.48-1.4-.9-.42-.4-.68-.8-.9-1.4-.17-.4-.36-1-.42-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.07-4.9c.06-1.2.25-1.8.42-2.2.22-.6.48-1 .9-1.4.4-.42.8-.68 1.4-.9.4-.17 1-.36 2.2-.42C8.4 2.2 8.8 2.2 12 2.2Zm0 1.8c-3.1 0-3.5 0-4.7.07-1 .05-1.6.22-1.9.36-.5.18-.8.4-1.2.76-.35.36-.58.7-.76 1.2-.14.3-.31.9-.36 1.9C3 11.5 3 11.9 3 15s0 3.5.07 4.7c.05 1 .22 1.6.36 1.9.18.5.4.8.76 1.2.36.35.7.58 1.2.76.3.14.9.31 1.9.36 1.2.07 1.6.07 4.7.07s3.5 0 4.7-.07c1-.05 1.6-.22 1.9-.36.5-.18.8-.4 1.2-.76.35-.36.58-.7.76-1.2.14-.3.31-.9.36-1.9.07-1.2.07-1.6.07-4.7s0-3.5-.07-4.7c-.05-1-.22-1.6-.36-1.9a3.2 3.2 0 0 0-.76-1.2 3.2 3.2 0 0 0-1.2-.76c-.3-.14-.9-.31-1.9-.36C15.5 4 15.1 4 12 4Zm0 3.1a4.9 4.9 0 1 1 0 9.8 4.9 4.9 0 0 1 0-9.8Zm0 1.8a3.1 3.1 0 1 0 0 6.2 3.1 3.1 0 0 0 0-6.2Zm5-2.4a1.15 1.15 0 1 1 0 2.3 1.15 1.15 0 0 1 0-2.3Z" />
  ),
  X: (
    <path d="M17.53 3H20l-5.9 6.74L21 21h-5.53l-4.33-5.66L6.2 21H3.7l6.3-7.2L3 3h5.66l3.92 5.18L17.53 3Zm-1.94 16h1.53L8.5 4.9H6.86l8.73 14.1Z" />
  ),
  TikTok: (
    <path d="M16.5 3c.3 2.1 1.5 3.6 3.5 3.8v2.6c-1.3.1-2.5-.3-3.6-1v6.6a5.9 5.9 0 1 1-5.9-5.9c.3 0 .6 0 .9.06v2.7a3.2 3.2 0 1 0 2.3 3.08V3h2.8Z" />
  ),
};

export default function Footer() {
  const cats = CATEGORY_DEFS.filter((c) => c.slug !== 'todo-rd');

  return (
    <footer className="mt-10 border-t border-white/10 pt-6 text-sm text-white/60">
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
        <div className="col-span-2 sm:col-span-1">
          <img src="/logo.png" alt="Top.com.do" className="h-7 w-auto" />
          <p className="mt-2 text-xs text-white/45">
            El directorio de autoridad de la República Dominicana. Ranking verificado de negocios
            por provincia y categoría.
          </p>
        </div>

        <div>
          <div className="mb-2 text-xs font-bold uppercase tracking-widest text-white/40">
            Categorías
          </div>
          <ul className="space-y-1.5 text-xs">
            {cats.map((c) => (
              <li key={c.slug}>
                <Link to={`/rd/${c.slug}`} className="hover:text-gold">
                  {cleanName(c.name)}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="mb-2 text-xs font-bold uppercase tracking-widest text-white/40">
            Explora
          </div>
          <ul className="space-y-1.5 text-xs">
            <li>
              <Link to="/" className="hover:text-gold">
                Ranking en vivo
              </Link>
            </li>
            <li>
              <Link to="/explorar" className="hover:text-gold">
                Explorar negocios
              </Link>
            </li>
            <li>
              <Link to="/login?registro=1" className="hover:text-gold">
                Crear cuenta gratis
              </Link>
            </li>
            <li>
              <Link to="/perfil" className="hover:text-gold">
                Publicar mi negocio
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <div className="mb-2 text-xs font-bold uppercase tracking-widest text-white/40">
            Síguenos
          </div>
          <div className="flex gap-2">
            {SOCIAL_LINKS.map((s) => (
              <a
                key={s.name}
                href={s.url}
                target="_blank"
                rel="me noopener noreferrer"
                aria-label={`${s.name} — ${s.label}`}
                title={`${s.name} ${s.label}`}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 text-white/80 transition hover:border-gold/60 hover:text-gold"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                  {ICONS[s.name]}
                </svg>
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 border-t border-white/5 py-4 text-center text-[11px] text-white/35">
        © {new Date().getFullYear()} Top.com.do · Marca registrada en ONAPI · República Dominicana
      </div>
    </footer>
  );
}

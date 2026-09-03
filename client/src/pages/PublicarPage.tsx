import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useShell } from '../hooks/useShell';
import { useAuth } from '../hooks/useAuth';
import { useSeo } from '../hooks/useSeo';
import { publicarSeo } from '@shared/seo';

const FAQS = [
  {
    q: '¿Cómo anuncio mi negocio en República Dominicana?',
    a: 'Regístrate gratis, publica tu negocio con su ubicación, WhatsApp y enlaces, y puja para colocarlo en el puesto #1 de tu categoría y provincia. Desde RD$100. No hay contratos ni agencias.',
  },
  {
    q: '¿Cuánto cuesta anunciar mi negocio?',
    a: 'Registrar y mostrar tu negocio es gratis. Para competir por el primer lugar del ranking pujas el monto que quieras, empezando en RD$100. Pagas solo si quieres liderar.',
  },
  {
    q: '¿Cómo salgo primero en Google en República Dominicana?',
    a: 'Cada negocio de Top.com.do tiene una página propia optimizada (título, reseñas y datos estructurados LocalBusiness) que Google y Bing indexan. Al liderar tu categoría apareces primero dentro del directorio y ganas visibilidad en los buscadores del país.',
  },
  {
    q: '¿Es una plataforma de publicidad y pauta comercial?',
    a: 'Sí. Top.com.do es un directorio y una subasta de visibilidad: publicidad efectiva y medible para negocios dominicanos, con clientes que te contactan directo por WhatsApp o llamada.',
  },
  {
    q: '¿En qué provincias funciona?',
    a: 'En las 32 demarcaciones del país. Tu negocio compite a la vez a nivel nacional ("Todo RD") y dentro de tu provincia con la misma puja.',
  },
];

function Faq({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="glass p-3.5">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left text-sm font-semibold"
        aria-expanded={open}
      >
        {q}
        <span aria-hidden className="text-gold">
          {open ? '−' : '+'}
        </span>
      </button>
      {open && <p className="mt-2 text-[13px] leading-relaxed text-white/65">{a}</p>}
    </div>
  );
}

export default function PublicarPage() {
  useSeo(publicarSeo());
  const { openBid } = useShell();
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <header className="space-y-3 pt-1">
        <h1 className="text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">
          <span className="text-gold">Anuncia tu negocio</span> en República Dominicana
        </h1>
        <p className="text-sm leading-relaxed text-white/70">
          Publicidad efectiva por provincia y categoría: registra tu negocio{' '}
          <span className="font-semibold text-emerald-soft">gratis</span>, puja para salir primero,
          posiciona tu negocio en Google y recibe clientes directos por WhatsApp. Desde RD$100, sin
          contratos ni agencias.
        </p>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => openBid()} className="btn-gold !px-5 !py-3 text-sm">
            ⚡ Crea tu puja ahora
          </button>
          {!user && (
            <Link to="/login?registro=1" className="btn-ghost !px-5 !py-3 text-sm">
              Registrarme gratis
            </Link>
          )}
        </div>
      </header>

      <section className="grid gap-2.5 sm:grid-cols-3">
        {[
          {
            t: 'Registra gratis',
            d: 'Crea tu cuenta y publica tu negocio con ubicación, WhatsApp, Instagram y web. Sin costo.',
          },
          {
            t: 'Puja para liderar',
            d: 'Supera el total del #1 de tu zona. El que más aporta se lleva el primer lugar y todo el tráfico del sector.',
          },
          {
            t: 'Recibe clientes',
            d: 'Los consumidores te contactan directo por WhatsApp o llamada. Publicidad medible, en vivo.',
          },
        ].map((x) => (
          <div key={x.t} className="glass space-y-1 p-3.5">
            <h2 className="text-sm font-bold text-gold">{x.t}</h2>
            <p className="text-[12.5px] leading-snug text-white/65">{x.d}</p>
          </div>
        ))}
      </section>

      <section className="glass space-y-2 border border-gold/25 p-4">
        <h2 className="text-base font-bold">Cómo hacer publicidad efectiva en RD con Top.com.do</h2>
        <p className="text-[13px] leading-relaxed text-white/65">
          La publicidad tradicional (vallas, radio, anuncios genéricos) es cara y difícil de medir.
          Aquí compites por un lugar concreto: el <span className="text-gold">#1</span> de tu
          categoría en tu provincia. Es una subasta de visibilidad — pagas por resultado, ves cuánto
          paga tu competencia y la superas al instante con tarjeta. Tu negocio aparece primero cuando
          alguien busca tu rubro en tu zona, con reseñas reales y contacto directo.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold">Preguntas frecuentes</h2>
        <div className="space-y-2">
          {FAQS.map((f) => (
            <Faq key={f.q} {...f} />
          ))}
        </div>
      </section>

      <section className="glass flex flex-col items-center gap-3 border border-gold/30 p-5 text-center shadow-glow">
        <p className="text-sm font-bold text-gold">Empieza hoy — desde RD$100</p>
        <button onClick={() => openBid()} className="btn-gold !px-6 !py-3 text-sm">
          ⚡ Crea tu puja ahora
        </button>
        <Link to="/normas" className="text-xs text-white/50 underline">
          Ver cómo funciona el ranking
        </Link>
      </section>
    </div>
  );
}

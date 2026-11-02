import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useSeo } from '../hooks/useSeo';
import Spinner from '../components/common/Spinner';
import { CATEGORY_SLUGS } from '@shared/categories';
import { isRealProvince, provinceName } from '@shared/provinces';
import { categoryLabel, publicarComboSeo, RD } from '@shared/seo';
import type { RankingEntry } from '@shared/types';

/**
 * `/publicar/:categoria(/:provincia)` — landing para dueños de negocio por categoría/zona.
 * Mismo copy en ambos modelos de ranking (nunca menciona pujas ni reseñas específicamente).
 */
export default function PublicarComboPage() {
  const { categoria = '', provincia } = useParams();
  const [businesses, setBusinesses] = useState<RankingEntry[] | null>(null);

  const validCategory = CATEGORY_SLUGS.includes(categoria) && categoria !== 'todo-rd';
  const validProvince = !provincia || isRealProvince(provincia);

  useEffect(() => {
    if (!validCategory || !validProvince) return;
    const qs = new URLSearchParams({ category: categoria, ...(provincia ? { province: provincia } : {}) });
    api<RankingEntry[]>(`/rankings?${qs}&limit=10`)
      .then(setBusinesses)
      .catch(() => setBusinesses([]));
  }, [categoria, provincia, validCategory, validProvince]);

  const seo = publicarComboSeo({
    categorySlug: categoria,
    provinceSlug: provincia ?? null,
    businessCount: businesses?.length ?? 0,
  });
  useSeo({ ...seo, noindex: businesses != null && businesses.length === 0 });

  if (!validCategory || !validProvince) return <Navigate to="/publicar" replace />;
  if (!businesses) return <Spinner />;

  const place = provincia ? provinceName(provincia) : RD;
  const cat = categoryLabel(categoria) || categoria;

  return (
    <div className="space-y-5">
      <header className="space-y-2 pt-1">
        <h1 className="text-2xl font-extrabold leading-tight tracking-tight">
          Publica tu negocio de <span className="text-gold">{cat}</span> gratis en {place}
        </h1>
        <p className="text-sm text-white/65">
          {businesses.length > 0
            ? `Ya hay ${businesses.length} negocio${businesses.length === 1 ? '' : 's'} de ${cat} en Top.com.do en ${place}. Regístrate gratis y aparece también en el ranking de tu zona.`
            : `Sé el primero en registrar tu negocio de ${cat} en Top.com.do en ${place}.`}
        </p>
        <Link to="/registrar-negocio" className="btn-gold inline-flex !px-5 !py-3 text-sm">
          Registrar mi negocio gratis
        </Link>
      </header>

      {businesses.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold text-white/80">¿Quieres aparecer aquí?</h2>
          <ul className="space-y-1.5">
            {businesses.map((e) => (
              <li key={e.profile.id} className="glass flex items-center justify-between p-2.5 text-sm">
                <span>
                  #{e.position} {e.profile.name}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

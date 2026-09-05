import { Link } from 'react-router-dom';
import { useFavorites } from '../hooks/useFavorites';
import { useAuth } from '../hooks/useAuth';
import { whatsappLink, avatarFallback } from '../lib/share';

export default function FavoritesPage() {
  const { user } = useAuth();
  const { list, toggle } = useFavorites();

  if (!user) {
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-extrabold">Favoritos</h1>
        <Link to="/login" className="btn-gold w-full">
          Inicia sesión para ver tus favoritos
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-extrabold">Favoritos</h1>
      {!list.length && (
        <p className="text-sm text-white/50">Aún no tienes favoritos. Toca ☆ en cualquier tarjeta.</p>
      )}
      {list.map((p) => (
        <div key={p.id} className="glass flex items-center gap-3 p-3">
          <img src={p.avatarUrl || avatarFallback(p.name)} width={44} height={44} loading="lazy" decoding="async" className="h-11 w-11 rounded-xl" alt="" />
          <Link to={`/p/${p.id}`} className="flex-1 font-semibold">
            {p.name}
          </Link>
          {p.whatsapp && (
            <a
              href={whatsappLink(p.whatsapp)}
              target="_blank"
              rel="noreferrer"
              className="btn-emerald !py-1.5 text-xs"
            >
              WhatsApp
            </a>
          )}
          <button onClick={() => toggle(p.id)} className="btn-ghost !py-1.5 text-xs">
            Quitar
          </button>
        </div>
      ))}
    </div>
  );
}

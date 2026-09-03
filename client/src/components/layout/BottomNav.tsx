import { NavLink } from 'react-router-dom';
import { useAuctionAccess } from '../../hooks/useAuctionAccess';

const items = [
  { to: '/', label: 'Ranking', icon: '🏆', end: true },
  { to: '/explorar', label: 'Explorar', icon: '🧭' },
  { to: '/mis-pujas', label: 'Mis Pujas', icon: '📈', auction: true },
  { to: '/favoritos', label: 'Favoritos', icon: '⭐' },
  { to: '/perfil', label: 'Perfil', icon: '👤' },
];

export default function BottomNav() {
  const canBid = useAuctionAccess();
  const visible = items.filter((it) => !it.auction || canBid);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40">
      <div className="mx-auto max-w-3xl px-3 pb-[calc(env(safe-area-inset-bottom)+10px)]">
        <div className="glass-strong flex items-center justify-between gap-1 rounded-2xl px-1.5 py-1.5">
          {visible.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-[10.5px] font-semibold transition ${
                  isActive ? 'bg-white/5 text-gold' : 'text-white/50 hover:text-white/80'
                }`
              }
            >
              <span className="text-[15px] leading-none">{it.icon}</span>
              {it.label}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}

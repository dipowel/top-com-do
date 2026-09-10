import type { SVGProps } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuctionAccess } from '../../hooks/useAuctionAccess';

/** Envoltura común de los íconos de línea (grid 24, trazo redondeado). */
function I({ children, ...p }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      {children}
    </svg>
  );
}

const TrophyIcon = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}>
    <path d="M6 4h12v3a6 6 0 0 1-12 0V4Z" />
    <path d="M9 20h6M12 15v5M6 6H3.5v1.5A3.5 3.5 0 0 0 6 11M18 6h2.5v1.5A3.5 3.5 0 0 1 18 11" />
  </I>
);
const CompassIcon = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m14.7 9.3-1.7 4-4 1.7 1.7-4 4-1.7Z" />
  </I>
);
const TrendingIcon = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}>
    <path d="M4 17.5 10 11l3.5 3.5L21 7" />
    <path d="M21 12V7h-5" />
  </I>
);
const StarIcon = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}>
    <path d="M12 4.2l2.45 5 5.5.8-4 3.9.95 5.5L12 22l-4.9-2.6.95-5.5-4-3.9 5.5-.8L12 4.2Z" />
  </I>
);
const UserIcon = (p: SVGProps<SVGSVGElement>) => (
  <I {...p}>
    <circle cx="12" cy="8.5" r="4" />
    <path d="M5 20c1-3.5 4-5.5 7-5.5s6 2 7 5.5" />
  </I>
);

const items = [
  { to: '/', label: 'Ranking', end: true, Icon: TrophyIcon },
  { to: '/explorar', label: 'Explorar', Icon: CompassIcon },
  { to: '/mis-pujas', label: 'Mis Pujas', auction: true, Icon: TrendingIcon },
  { to: '/favoritos', label: 'Favoritos', Icon: StarIcon },
  { to: '/perfil', label: 'Perfil', Icon: UserIcon },
];

export default function BottomNav() {
  const canBid = useAuctionAccess();
  const visible = items.filter((it) => !it.auction || canBid);

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-black/80 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
    >
      <div className="mx-auto flex max-w-3xl items-stretch justify-around px-1">
        {visible.map(({ to, label, end, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            aria-label={label}
            className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-1.5"
          >
            {({ isActive }) => (
              <>
                <span
                  className={`flex h-8 w-14 items-center justify-center rounded-full transition-colors ${
                    isActive ? 'bg-gold/15 text-gold' : 'text-white/55'
                  }`}
                >
                  <Icon className="h-[22px] w-[22px]" />
                </span>
                <span
                  className={`w-full truncate text-center text-[10px] leading-none transition-colors ${
                    isActive ? 'font-semibold text-gold' : 'font-medium text-white/55'
                  }`}
                >
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

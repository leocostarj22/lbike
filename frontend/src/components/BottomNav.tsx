import { NavLink } from 'react-router-dom';

const links = [
  { to: '/', label: 'Início' },
  { to: '/map', label: 'Mapa' },
  { to: '/record', label: 'Registar' },
  { to: '/activities', label: 'Actividades' },
  { to: '/profile', label: 'Perfil' },
];

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 flex justify-around bg-background py-2">
      {links.map(({ to, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            label === 'Registar'
              ? 'rounded-full bg-accent px-4 py-2 font-semibold text-background'
              : `px-3 py-2 text-sm ${isActive ? 'text-accent' : 'text-white'}`
          }
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

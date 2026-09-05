import React, {useEffect, useRef, useState} from 'react';
import {FileText, Settings} from './Icons.jsx';

const NAV_ITEMS = [
  {id: 'boletas', label: 'Boletas', longLabel: 'BOLETA DE VENTA', Icon: FileText},
  {id: 'settings', label: 'Emisores', longLabel: 'Emisores', Icon: Settings},
];

export function MainNavigation({currentView, onNavigate}) {
  const activeIndex = Math.max(0, NAV_ITEMS.findIndex(({id}) => id === currentView));
  const activeOffset = activeIndex === 0 ? '0px' : 'calc(100% + 8px)';
  const [isSettling, setIsSettling] = useState(false);
  const settleTimer = useRef(null);

  useEffect(() => {
    return () => {
      if (settleTimer.current) {
        window.clearTimeout(settleTimer.current);
      }
    };
  }, []);

  const handleNavigate = (id) => {
    if (id !== currentView) {
      if (settleTimer.current) {
        window.clearTimeout(settleTimer.current);
      }
      setIsSettling(true);
      settleTimer.current = window.setTimeout(() => setIsSettling(false), 360);
    }
    onNavigate(id);
  };

  return (
    <nav className="floating-navigation" aria-label="Navegación principal">
      <div
        className="floating-navigation__surface"
        data-settling={isSettling}
        style={{
          '--active-offset': activeOffset,
        }}
      >
        <span className="floating-navigation__liquid" aria-hidden="true" />
        {NAV_ITEMS.map(({id, label, longLabel, Icon: NavigationIcon}) => {
          const active = currentView === id;
          return (
            <button
              key={id}
              type="button"
              className="floating-navigation__item"
              data-active={active}
              aria-current={active ? 'page' : undefined}
              aria-label={longLabel}
              onClick={() => handleNavigate(id)}
            >
              <span className="floating-navigation__icon" aria-hidden="true">{React.createElement(NavigationIcon, {size: 20})}</span>
              <span className="floating-navigation__label">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

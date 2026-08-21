import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import type { IconType } from '@hugeicons/react';

export interface MobileNavItem {
  id: string;
  label: string;
  icon: IconType | React.ComponentType<any> | React.ReactNode;
  path?: string;
  onClick?: () => void;
  badgeCount?: number;
}

interface MobileBottomNavProps {
  items: MobileNavItem[];
  activeItemId?: string;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ items, activeItemId }) => {
  const location = useLocation();

  return (
    <>
      <nav className="mobile-bottom-nav" aria-label="Navegação principal mobile">
        <div className="mobile-bottom-nav__container">
          {items.map((item) => {
            const isActive = activeItemId 
              ? activeItemId === item.id 
              : item.path 
                ? (location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path))) 
                : false;

            const iconElement = React.isValidElement(item.icon) ? (
              item.icon
            ) : (
              <HugeiconsIcon icon={item.icon as IconType} size={22} />
            );

            const content = (
              <>
                <div className="mobile-bottom-nav__icon-wrapper">
                  {iconElement}
                  {item.badgeCount && item.badgeCount > 0 ? (
                    <span className="mobile-bottom-nav__badge">{item.badgeCount > 99 ? '99+' : item.badgeCount}</span>
                  ) : null}
                </div>
                <span className="mobile-bottom-nav__label">{item.label}</span>
                {isActive && <div className="mobile-bottom-nav__indicator" />}
              </>
            );

            if (item.onClick) {
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.onClick}
                  className={`mobile-bottom-nav__item ${isActive ? 'mobile-bottom-nav__item--active' : ''}`}
                  aria-label={item.label}
                >
                  {content}
                </button>
              );
            }

            return (
              <Link
                key={item.id}
                to={item.path || '#'}
                className={`mobile-bottom-nav__item ${isActive ? 'mobile-bottom-nav__item--active' : ''}`}
                aria-label={item.label}
              >
                {content}
              </Link>
            );
          })}
        </div>
      </nav>

      <style>{`
        .mobile-bottom-nav {
          display: none;
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 900;
          background: var(--color-bg-secondary);
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
          border-top: 1px solid var(--color-border);
          box-shadow: var(--shadow-lg, 0 -4px 24px rgba(0, 0, 0, 0.35));
          padding-bottom: env(safe-area-inset-bottom, 0px);
        }

        @media (max-width: 768px) {
          .mobile-bottom-nav {
            display: block;
          }
        }

        .mobile-bottom-nav__container {
          display: flex;
          align-items: center;
          justify-content: space-around;
          height: 60px;
          max-width: 600px;
          margin: 0 auto;
          padding: 0 0.5rem;
        }

        .mobile-bottom-nav__item {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3px;
          height: 100%;
          background: transparent;
          border: none;
          color: var(--color-text-secondary);
          text-decoration: none;
          position: relative;
          cursor: pointer;
          padding: 6px 0;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
        }

        .mobile-bottom-nav__item:active {
          transform: scale(0.92);
        }

        .mobile-bottom-nav__icon-wrapper {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 24px;
          color: inherit;
        }

        .mobile-bottom-nav__label {
          font-size: 0.6875rem;
          font-weight: 500;
          letter-spacing: -0.01em;
          color: inherit;
          white-space: nowrap;
        }

        .mobile-bottom-nav__item--active {
          color: var(--color-brand-primary);
        }

        .mobile-bottom-nav__item--active .mobile-bottom-nav__label {
          font-weight: 600;
        }

        .mobile-bottom-nav__indicator {
          position: absolute;
          top: 0;
          width: 24px;
          height: 3px;
          background: var(--color-brand-primary);
          border-radius: 0 0 var(--radius-sm, 3px) var(--radius-sm, 3px);
          box-shadow: 0 2px 8px rgba(217, 108, 0, 0.4);
        }

        .mobile-bottom-nav__badge {
          position: absolute;
          top: -4px;
          right: -8px;
          background: var(--color-error);
          color: var(--color-brand-lightest);
          font-size: 0.625rem;
          font-weight: 700;
          min-width: 16px;
          height: 16px;
          border-radius: var(--radius-full, 9999px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 4px;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
        }
      `}</style>
    </>
  );
};

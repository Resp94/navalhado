import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';

type HugeIconProp = React.ComponentProps<typeof HugeiconsIcon>['icon'];

export interface MobileNavItem {
  id: string;
  label: string;
  icon: HugeIconProp | React.ReactElement | React.ComponentType<{ size?: number; className?: string }>;
  path?: string;
  onClick?: () => void;
  badgeCount?: number;
}

interface MobileBottomNavProps {
  items: MobileNavItem[];
  activeItemId?: string;
}

const ITEM_BASE_CLASS =
  'flex-1 flex flex-col items-center justify-center gap-[3px] h-full bg-transparent border-none text-text-secondary no-underline relative cursor-pointer py-1.5 px-0 transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] touch-manipulation [-webkit-tap-highlight-color:transparent] active:scale-92';

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ items, activeItemId }) => {
  const location = useLocation();

  return (
    <nav
      className="hidden max-md:block fixed bottom-0 inset-x-0 z-[900] bg-bg-secondary backdrop-blur-[20px] backdrop-saturate-[180%] border-t border-border shadow-lg pb-[env(safe-area-inset-bottom,0px)]"
      aria-label="Navegação principal mobile"
    >
      <div className="flex items-center justify-around h-[60px] max-w-[600px] mx-auto px-2">
        {items.map((item) => {
          const isActive = activeItemId
            ? activeItemId === item.id
            : item.path
              ? (location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path)))
              : false;

          let iconElement: React.ReactNode;
          if (React.isValidElement(item.icon)) {
            iconElement = item.icon;
          } else if (typeof item.icon === 'function') {
            const CustomIcon = item.icon as React.ComponentType<{ size?: number; className?: string }>;
            iconElement = <CustomIcon size={22} />;
          } else {
            iconElement = <HugeiconsIcon icon={item.icon as HugeIconProp} size={22} />;
          }

          const itemClassName = `${ITEM_BASE_CLASS} ${isActive ? 'text-brand-primary' : ''}`;
          const labelClassName = `text-[0.6875rem] tracking-[-0.01em] text-inherit whitespace-nowrap ${isActive ? 'font-semibold' : 'font-medium'}`;

          const content = (
            <>
              <div className="relative flex items-center justify-center h-6 text-inherit">
                {iconElement}
                {item.badgeCount && item.badgeCount > 0 ? (
                  <span className="absolute -top-1 -right-2 bg-error text-brand-lightest text-[0.625rem] font-bold min-w-[16px] h-4 rounded-full flex items-center justify-center px-1 shadow-[0_1px_4px_rgba(0,0,0,0.3)]">
                    {item.badgeCount > 99 ? '99+' : item.badgeCount}
                  </span>
                ) : null}
              </div>
              <span className={labelClassName}>{item.label}</span>
              {isActive && (
                <div className="absolute top-0 w-6 h-[3px] bg-brand-primary rounded-b-sm shadow-[0_2px_8px_rgba(217,108,0,0.4)]" />
              )}
            </>
          );

          if (item.onClick) {
            return (
              <button
                key={item.id}
                type="button"
                onClick={item.onClick}
                className={itemClassName}
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
              className={itemClassName}
              aria-label={item.label}
            >
              {content}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

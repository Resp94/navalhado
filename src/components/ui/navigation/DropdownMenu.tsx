import React from 'react';
import * as RadixDropdownMenu from '@radix-ui/react-dropdown-menu';

export const DropdownMenu = RadixDropdownMenu.Root;
export const DropdownMenuTrigger = RadixDropdownMenu.Trigger;
export const DropdownMenuGroup = RadixDropdownMenu.Group;
export const DropdownMenuPortal = RadixDropdownMenu.Portal;
export const DropdownMenuSub = RadixDropdownMenu.Sub;
export const DropdownMenuSubTrigger = RadixDropdownMenu.SubTrigger;
export const DropdownMenuRadioGroup = RadixDropdownMenu.RadioGroup;

export type DropdownMenuContentProps = RadixDropdownMenu.DropdownMenuContentProps;

export const DropdownMenuContent = React.forwardRef<HTMLDivElement, DropdownMenuContentProps>(
  ({ className = '', sideOffset = 8, align = 'end', ...props }, ref) => (
    <DropdownMenuPortal>
      <RadixDropdownMenu.Content
        ref={ref}
        sideOffset={sideOffset}
        align={align}
        className={`z-[1000] min-w-[220px] bg-bg-secondary border border-border rounded-md shadow-[0_12px_28px_-4px_rgba(20,17,15,0.2),var(--shadow-lg)] p-[0.6rem] flex flex-col gap-[0.35rem] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 ${className}`}
        {...props}
      />
    </DropdownMenuPortal>
  )
);
DropdownMenuContent.displayName = 'DropdownMenuContent';

export type DropdownMenuLabelProps = RadixDropdownMenu.DropdownMenuLabelProps;

export const DropdownMenuLabel = React.forwardRef<HTMLDivElement, DropdownMenuLabelProps>(
  ({ className = '', ...props }, ref) => (
    <RadixDropdownMenu.Label
      ref={ref}
      className={`text-xs font-extrabold text-text-secondary uppercase tracking-[0.04em] px-[0.35rem] pb-[0.4rem] border-b border-border ${className}`}
      {...props}
    />
  )
);
DropdownMenuLabel.displayName = 'DropdownMenuLabel';

export type DropdownMenuItemProps = RadixDropdownMenu.DropdownMenuItemProps;

export const DropdownMenuItem = React.forwardRef<HTMLDivElement, DropdownMenuItemProps>(
  ({ className = '', ...props }, ref) => (
    <RadixDropdownMenu.Item
      ref={ref}
      className={`flex items-center gap-2 text-sm text-text-primary rounded-sm px-[0.5rem] py-[0.45rem] cursor-pointer outline-none transition-colors duration-150 data-[highlighted]:bg-text-primary/5 data-[disabled]:opacity-40 data-[disabled]:cursor-not-allowed ${className}`}
      {...props}
    />
  )
);
DropdownMenuItem.displayName = 'DropdownMenuItem';

export type DropdownMenuCheckboxItemProps = RadixDropdownMenu.DropdownMenuCheckboxItemProps;

export const DropdownMenuCheckboxItem = React.forwardRef<HTMLDivElement, DropdownMenuCheckboxItemProps>(
  ({ className = '', children, ...props }, ref) => (
    <RadixDropdownMenu.CheckboxItem
      ref={ref}
      className={`group flex items-center gap-2 text-sm text-text-primary rounded-sm px-[0.5rem] py-[0.45rem] cursor-pointer outline-none transition-colors duration-150 data-[highlighted]:bg-text-primary/5 data-[disabled]:opacity-40 data-[disabled]:cursor-not-allowed ${className}`}
      {...props}
    >
      <span className="w-4 h-4 rounded-[4px] shadow-[0_0_0_1px_var(--color-text-secondary)] flex items-center justify-center shrink-0 group-data-[state=checked]:bg-brand-primary group-data-[state=checked]:shadow-none">
        <RadixDropdownMenu.ItemIndicator>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
            <path d="M20 6L9 17L4 12" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </RadixDropdownMenu.ItemIndicator>
      </span>
      {children}
    </RadixDropdownMenu.CheckboxItem>
  )
);
DropdownMenuCheckboxItem.displayName = 'DropdownMenuCheckboxItem';

export const DropdownMenuSeparator = React.forwardRef<
  HTMLDivElement,
  RadixDropdownMenu.DropdownMenuSeparatorProps
>(({ className = '', ...props }, ref) => (
  <RadixDropdownMenu.Separator ref={ref} className={`h-px bg-border my-[0.2rem] -mx-[0.6rem] ${className}`} {...props} />
));
DropdownMenuSeparator.displayName = 'DropdownMenuSeparator';

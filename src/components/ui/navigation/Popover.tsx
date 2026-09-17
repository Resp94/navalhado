import React from 'react';
import * as RadixPopover from '@radix-ui/react-popover';

export const Popover = RadixPopover.Root;
export const PopoverTrigger = RadixPopover.Trigger;
export const PopoverAnchor = RadixPopover.Anchor;

export type PopoverContentProps = RadixPopover.PopoverContentProps;

export const PopoverContent = React.forwardRef<HTMLDivElement, PopoverContentProps>(
  ({ className = '', sideOffset = 8, align = 'start', ...props }, ref) => (
    <RadixPopover.Portal>
      <RadixPopover.Content
        ref={ref}
        sideOffset={sideOffset}
        align={align}
        className={`z-[1000] bg-bg-secondary border border-border rounded-md shadow-[0_12px_28px_-4px_rgba(20,17,15,0.2),var(--shadow-lg)] outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 ${className}`}
        {...props}
      />
    </RadixPopover.Portal>
  )
);
PopoverContent.displayName = 'PopoverContent';

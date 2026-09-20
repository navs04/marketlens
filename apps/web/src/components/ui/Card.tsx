import type { PropsWithChildren } from "react";

interface CardProps extends PropsWithChildren {
  className?: string;
  emphasis?: boolean;
}

/**
 * Base surface for content blocks. Deliberately uses a 1px border rather
 * than a drop shadow as the default elevation cue (see design notes) -
 * shadows are reserved for genuinely floating elements like dropdowns.
 * `emphasis` adds the accent top-bar used for the single "hero" card
 * on a page (e.g. current price), never applied to more than one card
 * at a time.
 */
export function Card({ children, className = "", emphasis = false }: CardProps) {
  return (
    <div
      className={`rounded-md border border-line bg-paper-raised ${
        emphasis ? "border-t-2 border-t-accent" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

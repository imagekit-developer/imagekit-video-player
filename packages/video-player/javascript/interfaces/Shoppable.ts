import type { Transformation }from '@imagekit/javascript'

export interface Hotspot {
  time: string;    // e.g. "00:02"
  x: string;       // e.g. "50%"
  y: string;       // e.g. "50%"
  tooltipPosition?: 'left' | 'right' | 'top' | 'bottom';
  clickUrl: string;
}

export type InteractionProps =
  | {
      action: 'overlay';
      /** in seconds or true/false for pause behavior */
      pause?: number | boolean;
      /** The overlay text to display */
      args?: string;
    }
  | {
      action: 'seek';
      /** in seconds or true/false for pause behavior */
      pause?: number | boolean;
      /** Time to seek to (e.g., "00:06") */
      args?: {
        time?: string;
      };
    }
  | {
      action: 'goto' | 'switch';
      /** in seconds or true/false for pause behavior */
      pause?: number | boolean;
      /** URL to navigate to or switch to */
      args?: {
        url?: string;
      };
    };

export interface ProductProps {
  productId: number;
  productName: string;
  imageUrl: string;
  highlightTime?: { start: number; end: number };
  hotspots?: Hotspot[];
  onHover?: InteractionProps;
  onClick?: InteractionProps;
}

export interface ShoppableProps {
  autoClose?: number | false;
  products: ProductProps[];
  showPostPlayOverlay?: boolean;
  startState?: 'closed' | 'open' | 'openOnPlay';
  toggleIconUrl?: string;
  transformation?: Transformation[];
  width?: number; // percentage of player width
}

import type { Transformation }from '@imagekit/javascript'

export interface Hotspot {
  time: string;    // e.g. "00:02"
  x: string;       // e.g. "50%"
  y: string;       // e.g. "50%"
  tooltipPosition?: 'left' | 'right' | 'top' | 'bottom';
  clickUrl: string;
}

export interface InteractionProps {
  action: 'overlay' | 'seek' | 'goto' | 'switch';
  /** in seconds or true/false for pause behavior */
  pause?: number | boolean;
  args?: {
    time?: string;
    url?: string;
  };
}

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
  autoClose?: number;
  products: ProductProps[];
  showPostPlayOverlay?: boolean;
  startState?: 'closed' | 'open' | 'openOnPlay';
  toggleIconUrl?: string;
  transformation?: Transformation[];
  width?: number; // percentage of player width
}

export interface PlaylistOptions {
  /** seconds delay to auto-advance, or false to disable */
  autoAdvance?: number | false;
  /** loop playlist when it ends */
  repeat?: boolean;
  /** seconds before end to show “next up” thumbnail, or true for default 10s */
  presentUpcoming?: boolean | number;
  widgetProps?: {
    direction?: 'vertical' | 'horizontal';
  };
}

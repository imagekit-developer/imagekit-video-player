export interface ABSOptions {
    protocol: 'hls' | 'dash';
    /** Supported resolutions, e.g. [240,360,720,1080] */
    sr: number[];
  }
  
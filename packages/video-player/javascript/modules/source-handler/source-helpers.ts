import type { SourceOptions } from '../../interfaces';
import type { AugmentedSourceOptions } from '../../interfaces/AugementedSourceOptions';

/**
 * Ensures that a source has a prepared object for caching prepared values.
 */
export function ensurePrepared(src: AugmentedSourceOptions): NonNullable<AugmentedSourceOptions['prepared']> {
  if (!src.prepared) src.prepared = {};
  return src.prepared;
}

/**
 * Checks if a source already has a prepared src URL.
 */
export function hasPreparedSrc(opts: SourceOptions): opts is AugmentedSourceOptions {
  return (opts as any).prepared && typeof (opts as any).prepared.src === 'string';
}

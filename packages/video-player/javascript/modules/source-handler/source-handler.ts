import type Player from 'video.js/dist/types/player';
import type { IKPlayerOptions, RemoteTextTrackOptions, SourceOptions, ShoppableProps } from '../../interfaces';
import type { AugmentedSourceOptions } from '../../interfaces/AugementedSourceOptions';
import { waitForVideoReady, prepareSource, preparePosterSrc } from '../../utils';
import { setTextTracks, validateRemoteTextTrackOptions } from '../subtitles/subtitles';
import { hasPreparedSrc, ensurePrepared } from './source-helpers';

/**
 * Options for creating a source override handler.
 */
export interface SourceOverrideOptions {
  /** ImageKit player options */
  options: IKPlayerOptions;
  /** Callback to get the current source */
  getCurrentSource: () => SourceOptions | null;
  /** Callback to get the original current source */
  getOriginalCurrentSource: () => SourceOptions | null;
  /** Callback to update the current source */
  onSourceUpdate: (source: SourceOptions) => void;
  /** Callback to update the original source */
  onOriginalSourceUpdate: (source: SourceOptions) => void;
  /** Function to check if a source has prepared src */
  hasPreparedSrc: (opts: SourceOptions) => opts is AugmentedSourceOptions;
}

function showLoadingState(player: Player): void {
  const bigPlay = player.getChild('BigPlayButton');
  bigPlay && bigPlay.hide();
  const spinner = player.getChild('LoadingSpinner');
  player.addClass('vjs-waiting');
  spinner?.el()?.setAttribute('aria-hidden', 'false');
}

function hideLoadingState(player: Player): void {
  const bigPlay = player.getChild('BigPlayButton');
  bigPlay && bigPlay.show();
  player.removeClass('vjs-waiting');
  const spinner = player.getChild('LoadingSpinner');
  spinner?.el()?.setAttribute('aria-hidden', 'true');
}

function validateSourceOptions(source: SourceOptions): void {
  if (!source.src || typeof source.src !== 'string') {
    throw new Error('`src` is required and must be a non-empty string.');
  }

  if (source.textTracks) {
    if (!Array.isArray(source.textTracks)) {
      throw new Error('`textTracks` must be an array.');
    }
    source.textTracks.forEach((track, index) => {
      try {
        validateRemoteTextTrackOptions(track);
      } catch (err) {
        throw new Error(`\`textTracks[${index}]\`: ${err instanceof Error ? err.message : String(err)}`);
      }
    });
  }

  if (source.recommendations) {
    if (!Array.isArray(source.recommendations)) {
      throw new Error('`recommendations` must be an array.');
    }
    source.recommendations.forEach((rec, index) => {
      try {
        validateSourceOptions(rec);
      } catch (err) {
        throw new Error(`\`recommendations[${index}]\`: ${err instanceof Error ? err.message : String(err)}`);
      }
    });
  }

  if (source.shoppable) {
    const shoppable = source.shoppable as ShoppableProps;
    if (!Array.isArray(shoppable.products)) {
      throw new Error('`shoppable.products` is required and must be an array.');
    }
    if (shoppable.products.length === 0) {
      throw new Error('`shoppable.products` must contain at least one product.');
    }
    if (shoppable.autoClose !== undefined && shoppable.autoClose !== false && (typeof shoppable.autoClose !== 'number' || shoppable.autoClose < 0)) {
      throw new Error('`shoppable.autoClose` must be a non-negative number or false.');
    }
    if (shoppable.startState && !['closed', 'open', 'openOnPlay'].includes(shoppable.startState)) {
      throw new Error("`shoppable.startState` must be 'closed', 'open', or 'openOnPlay'.");
    }
    if (shoppable.width !== undefined && (typeof shoppable.width !== 'number' || shoppable.width < 0 || shoppable.width > 100)) {
      throw new Error('`shoppable.width` must be a number between 0 and 100.');
    }
    shoppable.products.forEach((product, index) => {
      if (typeof product.productId !== 'number') {
        throw new Error(`\`shoppable.products[${index}].productId\` is required and must be a number.`);
      }
      if (!product.productName || typeof product.productName !== 'string') {
        throw new Error(`\`shoppable.products[${index}].productName\` is required and must be a non-empty string.`);
      }
      if (!product.imageUrl || typeof product.imageUrl !== 'string') {
        throw new Error(`\`shoppable.products[${index}].imageUrl\` is required and must be a non-empty string.`);
      }
    });
  }
}

async function prepareSourceIfNeeded(
  source: SourceOptions,
  options: IKPlayerOptions
): Promise<SourceOptions> {
  if (hasPreparedSrc(source)) {
    return source;
  }
  return prepareSource(source, options);
}

/**
 * Sets up text tracks (subtitles/captions) for the player from the current source.
 */
function setupTextTracks(
  player: Player,
  source: SourceOptions,
  options: IKPlayerOptions
): void {
  const textTracks = source.textTracks || [];
  if (textTracks.length) {
    setTextTracks(player, textTracks as RemoteTextTrackOptions[], source, options.signerFn);
  }
}

/**
 * Sets up the poster image for the player from the current source.
 */
function setupPoster(
  player: Player,
  source: SourceOptions,
  options: IKPlayerOptions
): void {
  const preparedPoster = (source as AugmentedSourceOptions | null | undefined)?.prepared?.poster;
  
  if (preparedPoster) {
    player.poster(preparedPoster);
  } else {
    preparePosterSrc(source, options).then(
      poster => {
        if (poster) {
          player.poster(poster);
        }
        ensurePrepared(source as AugmentedSourceOptions).poster = poster ?? undefined;
      }
    ).catch(err => {
      player.log.error(`Failed to load poster: ${err.message}`);
    });
  }
}

/**
 * Creates a source override function that replaces Video.js's native src method.
 * This handles ImageKit source preparation, validation, and setup.
 * 
 * @param player - The Video.js player instance
 * @param overrideOptions - Options for the source override
 * @returns A function that can be assigned to player.src
 */
export function createSourceOverride(
  player: Player,
  overrideOptions: SourceOverrideOptions
): any {
  const { options, getCurrentSource, getOriginalCurrentSource, onSourceUpdate, onOriginalSourceUpdate, hasPreparedSrc } = overrideOptions;
  const nativeSrc = player.src.bind(player);
  let srcCallVersion = 0;

  return (source?: SourceOptions) => {
    if (source === undefined) {
      return getOriginalCurrentSource();
    }

    validateSourceOptions(source);

    // Clone the source immediately after validation to prevent mutating the original
    const sourceClone = { ...source };
    onOriginalSourceUpdate({ ...sourceClone });
    onSourceUpdate({ ...sourceClone });

    const myCallId = ++srcCallVersion;

    showLoadingState(player);

    const currentSource = getCurrentSource();
    if (!currentSource) {
      return;
    }

    prepareSourceIfNeeded(currentSource, options)
      .then(async (prepared: SourceOptions) => {
        if (myCallId !== srcCallVersion) {
          return;
        }

        const { maxTries, videoTimeoutInMS, delayInMS } = options;

        if (!hasPreparedSrc(currentSource)) {
          ensurePrepared(currentSource as AugmentedSourceOptions).src = prepared.src;
        }

        onSourceUpdate(prepared);

        await waitForVideoReady(
          prepared.src,
          maxTries!,
          videoTimeoutInMS!,
          delayInMS
        );

        nativeSrc(prepared as any);

        setupTextTracks(player, prepared, options);
        setupPoster(player, prepared, options);
      })
      .catch(err => {
        if (myCallId === srcCallVersion) {
          player.error(err.message);
        }
      })
      .finally(() => {
        if (myCallId === srcCallVersion) {
          hideLoadingState(player);
        }
      });
  };
}

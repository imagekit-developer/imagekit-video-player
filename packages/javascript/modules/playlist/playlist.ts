// src/modules/playlist.ts
import videojs from 'video.js';
import type EventTarget from 'video.js/dist/types/event-target';
import { isIndexInBounds, randomize } from './utils';
import type { SourceOptions } from '../../interfaces';

/**
 * A playlist of SourceOptions, with standard operations and events.
 */
export class Playlist extends (videojs.EventTarget as typeof EventTarget) {
  private items_: SourceOptions[];
  private currentIndex_: number | null;
  private repeat_: boolean;
  private onError_: (msg: string) => void;
  private onWarn_: (msg: string) => void;

  /**
   * Factory: create & populate in one call.
   */
  static from(
    items: SourceOptions[],
    options: { onError?: (msg: string) => void; onWarn?: (msg: string) => void }
  ) {
    const p = new Playlist(options);
    p.setItems(items);
    return p;
  }

  constructor(options: { onError?: (msg: string) => void; onWarn?: (msg: string) => void } = {}) {
    super();
    this.items_ = [];
    this.currentIndex_ = null;
    this.repeat_ = false;
    this.onError_ = options.onError || (() => {});
    this.onWarn_  = options.onWarn  || (() => {});
  }

  /** Replace entire list (only valid items kept). */
  setItems(items: SourceOptions[]): SourceOptions[] {
    if (!Array.isArray(items)) {
      this.onError_('Playlist must be an array of source definitions.');
      return [...this.items_];
    }
    const valid = items.filter(src => src && typeof src.src === 'string');
    if (!valid.length) {
      this.onError_('No valid playlist items provided.');
      return [...this.items_];
    }
    this.items_ = valid;
    this.trigger('playlistchange');
    return [...this.items_];
  }

  /** Shallow clone of current list. */
  getItems(): SourceOptions[] {
    return [...this.items_];
  }

  /** Remove all items. */
  reset(): void {
    this.items_ = [];
    this.currentIndex_ = null;
    this.trigger('playlistchange');
  }

  /** Enable or disable looping. */
  enableRepeat(): void { this.repeat_ = true; }
  disableRepeat(): void { this.repeat_ = false; }
  isRepeatEnabled(): boolean { return this.repeat_; }

  /** Change which index is “current.” */
  setCurrentIndex(i: number| null): void {
    if (i && !isIndexInBounds(this.items_, i)) {
      this.onError_('Index out of bounds.');
      return;
    }
    this.currentIndex_ = i;
  }

  getCurrentIndex(): number {
    return this.currentIndex_ === null ? -1 : this.currentIndex_;
  }

  getCurrentItem(): SourceOptions | undefined {
    return this.items_[this.currentIndex_!];
  }

  getLastIndex(): number {
    return this.items_.length ? this.items_.length - 1 : -1;
  }

  getNextIndex(): number {
    if (this.currentIndex_ === null) { return -1; }
    const nxt = (this.currentIndex_ + 1) % this.items_.length;
    return this.repeat_ || nxt !== 0 ? nxt : -1;
  }

  getPreviousIndex(): number {
    if (this.currentIndex_ === null) { return -1; }
    const prev = (this.currentIndex_ - 1 + this.items_.length) % this.items_.length;
    return this.repeat_ || prev !== this.items_.length - 1 ? prev : -1;
  }

  /** Insert one or many new SourceOptions at `index`. */
  add(items: SourceOptions | SourceOptions[], index?: number): SourceOptions[] {
    const arr = Array.isArray(items) ? items : [items];
    const valid = arr.filter(src => src && typeof src.src === 'string');
    if (!valid.length) {
      this.onError_('No valid items to add.');
      return [];
    }
    const idx = (typeof index !== 'number' || index < 0 || index > this.items_.length)
      ? this.items_.length
      : index;
    this.items_.splice(idx, 0, ...valid);
    if (this.currentIndex_ !== null && idx <= this.currentIndex_) {
      this.currentIndex_! += valid.length;
    }
    this.trigger({ type: 'playlistadd', count: valid.length, index: idx });
    return valid;
  }

  /** Remove `count` items starting at `index`. */
  remove(index: number, count = 1): SourceOptions[] {
    if (!isIndexInBounds(this.items_, index) || count < 0) {
      this.onError_('Invalid removal parameters.');
      return [];
    }
    const actual = Math.min(count, this.items_.length - index);
    const removed = this.items_.splice(index, actual);
    // adjust currentIndex_ if necessary
    if (this.currentIndex_ !== null) {
      if (this.currentIndex_ < index) {
        // no change
      } else if (this.currentIndex_ >= index + actual) {
        this.currentIndex_ -= actual;
      } else {
        this.currentIndex_ = null;
      }
    }
    this.trigger({ type: 'playlistremove', count: actual, index });
    return removed;
  }

  /** Sort in-place, preserving the current item if possible. */
  sort(compare: (a: SourceOptions, b: SourceOptions) => number): void {
    if (!this.items_.length || typeof compare !== 'function') { return; }
    const current = this.getCurrentItem();
    this.items_.sort(compare);
    this.currentIndex_ = current == null
      ? null
      : this.items_.findIndex(i => i === current);
    this.trigger('playlistsorted');
  }

  /** Reverse list order, adjusting current index. */
  reverse(): void {
    if (!this.items_.length) { return; }
    this.items_.reverse();
    if (this.currentIndex_ !== null) {
      this.currentIndex_ = this.items_.length - 1 - this.currentIndex_;
    }
    this.trigger('playlistsorted');
  }

  /**
   * Shuffle either the whole list, or the 'rest' after the current index.
   */
  shuffle({ rest = true } = {}): void {
    const start = rest && this.currentIndex_ !== null ? this.currentIndex_ + 1 : 0;
    const tail = this.items_.slice(start);
    if (tail.length <= 1) { return; }
    const current = this.getCurrentItem();
    randomize(tail);
    if (rest && this.currentIndex_ !== null) {
      this.items_.splice(start, tail.length, ...tail);
    } else {
      this.items_ = tail;
    }
    this.currentIndex_ = current == null
      ? null
      : this.items_.findIndex(i => i === current);
    this.trigger('playlistsorted');
  }
}
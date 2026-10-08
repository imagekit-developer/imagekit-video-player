// src/modules/playlist/up-next-overlay.ts

import videojs from 'video.js';
import type Player from 'video.js/dist/types/player';
import type ComponentType from 'video.js/dist/types/component';
import type { IKPlayerOptions, SourceOptions } from '../../interfaces';
import { preparePosterSrc, CleanupRegistry } from '../../utils';
import { announce } from '../a11y/announcer';

const Component = videojs.getComponent('Component') as typeof ComponentType;

/**
 * Full-player "Up next in N" overlay shown during the auto-advance countdown,
 * YouTube-style: thumbnail, title and description, with Cancel / Play now below.
 * Covers the video area only, so the control bar stays usable underneath.
 * WCAG 2.2.1 (the viewer can cancel the timer) and 4.1.3 (countdown announced).
 */
export class UpNextOverlay extends Component {
  private playerOptions_: IKPlayerOptions;
  private labelEl_!: HTMLElement;
  private secondsEl_!: HTMLElement;
  private thumbnailEl_!: HTMLElement;
  private titleEl_!: HTMLElement;
  private descriptionEl_!: HTMLElement;
  private cancelButtonEl_!: HTMLButtonElement;
  private playButtonEl_!: HTMLButtonElement;
  private cleanup_: CleanupRegistry;
  private item_?: SourceOptions;

  constructor(player: Player, playerOptions: IKPlayerOptions) {
    super(player);
    this.cleanup_ = new CleanupRegistry();
    this.playerOptions_ = playerOptions;

    const content = videojs.dom.createEl('div', { className: 'vjs-up-next-overlay-content' }) as HTMLElement;

    this.labelEl_ = videojs.dom.createEl('div', { className: 'vjs-up-next-overlay-label' }) as HTMLElement;
    this.labelEl_.id = `${player.id()}-up-next-overlay-label`;
    this.secondsEl_ = videojs.dom.createEl('span', { className: 'vjs-up-next-overlay-seconds' }) as HTMLElement;

    // Mouse users can click the poster to play now; keyboard users have the Play now button.
    this.thumbnailEl_ = videojs.dom.createEl('div', { className: 'vjs-up-next-overlay-thumbnail' }) as HTMLElement;
    this.titleEl_ = videojs.dom.createEl('div', { className: 'vjs-up-next-overlay-title' }) as HTMLElement;
    this.descriptionEl_ = videojs.dom.createEl('div', { className: 'vjs-up-next-overlay-description' }) as HTMLElement;

    const actions = videojs.dom.createEl('div', { className: 'vjs-up-next-overlay-actions' }) as HTMLElement;
    this.cancelButtonEl_ = videojs.dom.createEl('button', { className: 'vjs-up-next-overlay-cancel' }, { type: 'button' }, this.localize('Cancel')) as HTMLButtonElement;
    this.playButtonEl_ = videojs.dom.createEl('button', { className: 'vjs-up-next-overlay-play' }, { type: 'button' }, this.localize('Play now')) as HTMLButtonElement;
    actions.appendChild(this.cancelButtonEl_);
    actions.appendChild(this.playButtonEl_);

    content.appendChild(this.labelEl_);
    content.appendChild(this.thumbnailEl_);
    content.appendChild(this.titleEl_);
    content.appendChild(this.descriptionEl_);
    content.appendChild(actions);
    this.el().appendChild(content);

    // Not a modal dialog: the control bar below stays usable.
    this.el().setAttribute('role', 'group');
    this.el().setAttribute('aria-labelledby', this.labelEl_.id);

    this.cleanup_.registerEventListener(this.cancelButtonEl_, 'click', () => this.trigger('cancel'));
    this.cleanup_.registerEventListener(this.playButtonEl_, 'click', () => this.trigger('playnow'));
    this.cleanup_.registerEventListener(this.thumbnailEl_, 'click', () => this.trigger('playnow'));
    // Keys inside the overlay belong to its buttons, not to the player shortcuts.
    this.cleanup_.registerEventListener(this.el(), 'keydown', (e: Event) => {
      if ((e as KeyboardEvent).key !== 'Escape') e.stopPropagation();
    });

    this.hide();
  }

  createEl(): HTMLElement {
    return videojs.dom.createEl('div', { className: 'vjs-up-next-overlay' }) as HTMLElement;
  }

  /**
   * Shows the overlay for `item` with `seconds` left, and announces it. Focus moves
   * to Cancel only if the viewer was already using the player.
   */
  public start(item: SourceOptions, seconds: number): void {
    const focusWasInPlayer = (this.player_.el() as HTMLElement).contains(document.activeElement);
    const title = item.info?.title || this.localize('Untitled Video');

    if (this.item_ !== item) {
      this.item_ = item;
      this.titleEl_.textContent = title;
      this.descriptionEl_.textContent = item.info?.description || '';
      this.descriptionEl_.classList.toggle('vjs-hidden', !item.info?.description);
      this.loadThumbnail_(item);
    }

    this.setSeconds(seconds);
    this.show();
    announce(
      this.player_ as unknown as Player,
      this.localize('Next video, {1}, starts in {2} seconds. Press Escape to cancel.', [title, String(seconds)])
    );
    if (focusWasInPlayer) this.cancelButtonEl_.focus();
  }

  /** Updates the visible "Up next in N" count. */
  public setSeconds(seconds: number): void {
    this.secondsEl_.textContent = String(seconds);
    this.labelEl_.textContent = `${this.localize('Up next in')} `;
    this.labelEl_.appendChild(this.secondsEl_);
  }

  /**
   * Hides the overlay. If it had keyboard focus, focus moves to the play control,
   * or to the player root when the control bar is hidden (a new source is loading).
   */
  hide(): void {
    const hadFocus = !!this.el_ && this.el().contains(document.activeElement);
    super.hide();
    if (!hadFocus) return;
    const playToggle = (this.player_ as any).getChild('ControlBar')?.getChild('PlayToggle')?.el() as HTMLElement | undefined;
    if (playToggle && playToggle.offsetParent !== null) {
      playToggle.focus();
    } else {
      (this.player_.el() as HTMLElement).focus();
    }
  }

  private async loadThumbnail_(item: SourceOptions) {
    this.thumbnailEl_.innerHTML = '';
    this.thumbnailEl_.classList.remove('vjs-playlist-thumbnail-placeholder');
    try {
      const posterUrl = await preparePosterSrc(item, this.playerOptions_);
      if (this.item_ !== item) return;
      const img = document.createElement('img');
      img.src = posterUrl;
      // Decorative: the title right below names the next video.
      img.alt = '';
      this.thumbnailEl_.appendChild(img);
    } catch (e) {
      this.thumbnailEl_.classList.add('vjs-playlist-thumbnail-placeholder');
      this.player_.log.error('Failed to load "Up next" overlay poster:', e);
    }
  }

  dispose(): void {
    this.cleanup_.dispose();
    super.dispose();
  }
}

videojs.registerComponent('UpNextOverlay', UpNextOverlay as any);

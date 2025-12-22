import videojs from 'video.js';
import type { Transformation } from '@imagekit/javascript'
import { preparePosterSrc } from '../../utils';
import { AugmentedSourceOptions } from '../../interfaces/AugementedSourceOptions';
import type Player from 'video.js/dist/types/player';


// Get the ClickableComponent base class from Video.js
const ClickableComponent = videojs.getComponent('ClickableComponent');

interface ThumbnailInitOptions {
  item?: AugmentedSourceOptions
  transformation?: Transformation; // Transformation options for the thumbnail, if provided will override the default
  classes?: {
    thumbnail?: string;
    spinner?: string;
    placeholder?: string;
  }
}

const THUMB_DEFAULT_WIDTH = 300;

const DEFAULT_TRANSFORMATION: Transformation = {
  width: THUMB_DEFAULT_WIDTH,
  aspectRatio: '16-9',
  cropMode: 'pad_resize',
  background: 'black',
}

const DEFAULT_OPTIONS: ThumbnailInitOptions = {
  item: null,
  transformation: DEFAULT_TRANSFORMATION,
};

class Thumbnail extends ClickableComponent {

  constructor(player: Player, initOptions: ThumbnailInitOptions) {
    const options = videojs.obj.merge(DEFAULT_OPTIONS, initOptions);
    super(player, options);
  }



  getTitle() {
    return this.getItem()?.info?.title;
  }

  async getThumbnail() {
    const item = this.getItem();
    if (!item) {
      throw new Error('No item provided for thumbnail');
    }
    if (item.prepared.playlistThumbnail) {
      return item.prepared.playlistThumbnail;
    }
    if (!item.poster?.transformation) {
      if (!item.poster) {
        item.poster = {};
      }
      item.poster.transformation = [DEFAULT_TRANSFORMATION]

    }
    const preparedUrl = await preparePosterSrc(item, this.options_.playerOptions)
    item.prepared.playlistThumbnail = preparedUrl; // Store the prepared URL in the item
    return preparedUrl;
  }

  handleClick(e: Event): void {
    e.preventDefault();
  }

  createControlTextEl() {
    return;
  }

  createEl(tag = 'a') {

    // Thumbnail
    const thumbnail = super.createEl(tag, {
      className: this.options_?.classes?.thumbnail ?? 'vjs-playlist-thumbnail',
      href: '#'
    });


    // Spinner
    const spinner = super.createEl('div', {
      className: this.options_?.classes?.spinner ?? 'vjs-playlist-thumbnail-spinner',
    });

    thumbnail.appendChild(spinner);

    this.getThumbnail().then((url) => {
      if (!this.el_) {
        return;
      }
      if (spinner) {
        spinner.remove();
      }

      const imgEl = super.createEl('img', {
        loading: 'lazy',
        src: url,
        alt: this.getTitle() || '',
      });
      thumbnail.appendChild(imgEl);
    })
      .catch((err) => {
        if (!this.el_) {
          return;
        }
        this.player_.error({
          message: `Failed to load thumbnail for playlist item: ${err.message}`,
          cause: err,
        });
        if (spinner) {
          spinner.remove();
        }
        thumbnail.classList.add(this.options_?.classes?.placeholder ?? 'vjs-playlist-thumbnail-placeholder');
      });

    return thumbnail;
  }

}

// @ts-ignore
videojs.registerComponent('Thumbnail', Thumbnail);

export default Thumbnail;

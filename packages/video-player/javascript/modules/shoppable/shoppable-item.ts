import { ProductProps, Transformation, SourceOptions } from 'javascript/interfaces';
import { AugmentedSourceOptions } from 'javascript/interfaces/AugementedSourceOptions';
import { preparePosterSrc } from 'javascript/utils';
import * as _ from 'lodash';
import videojs from 'video.js';
import type Player from 'video.js/dist/types/player';

const ClickableComponent = videojs.getComponent('ClickableComponent');
const dom = videojs.dom || videojs;

const DEFAULT_TRANSFORMATION: Transformation = {
    width: 400,
    height: 400,
    cropMode: 'pad_resize',
    background: 'white',
}

interface ShoppablePanelItemOptions {
    source: AugmentedSourceOptions;
    item: ProductProps;
    transformation?: Transformation[];
    index: number;
    clickHandler: Function;
    children?: any[];
    className?: string;
}

class ShoppablePanelItem extends ClickableComponent {
    private spinnerEl!: HTMLElement;
    private imgEl?: HTMLImageElement;
    private altImgEl?: HTMLImageElement;

    constructor(player: Player, initOptions: ShoppablePanelItemOptions) {
        super(player, initOptions);

        this.on('mouseenter', () => this.handleMouseEnter());
    }

    handleClick(event: Event) {
        event.preventDefault();
        event.stopPropagation();
        this.options_.clickHandler(event);
    }

    handleMouseEnter() {
        this.player_.trigger('productHover', { product: this.getItem() });
    }

    private getItem() {
        return this.options_.item;
    }

    private getTransformation() {
        return this.options_.transformation || [DEFAULT_TRANSFORMATION];
    }

    private getItemIndex() {
        return this.options_.index;
    }

    private async getThumbnail(altImg?: boolean): Promise<string> {
        const item = this.getItem();
        const index = this.getItemIndex();

        if (!item) {
            throw new Error('No item provided for shoppable item thumbnail');
        }

        // 1. Determine which image URL and cache position to use.
        const isAlt = !!altImg;
        const cacheIndex = isAlt ? 1 : 0;
        // Type-safe: when isAlt is true, we know onHover.action is 'switch' or 'goto', so args is an object with url
        const imageUrl = isAlt && item.onHover && (item.onHover.action === 'switch' || item.onHover.action === 'goto') && typeof item.onHover.args === 'object' && item.onHover.args?.url
            ? item.onHover.args.url
            : item.imageUrl;

        // 2. Validate that we found a URL to process.
        if (!imageUrl) {
            const imageType = isAlt ? 'alternate' : 'main';
            throw new Error(`No ${imageType} image URL found.`);
        }

        const source = this.options_.source as AugmentedSourceOptions;

        // 3. Ensure the nested cache structure exists.
        source.prepared = source?.prepared || {};
        source.prepared.shoppableThumbnails = source?.prepared?.shoppableThumbnails || {};
        source.prepared.shoppableThumbnails[index] = source?.prepared?.shoppableThumbnails?.[index] || [];

        // 4. Check the cache and return the URL if it already exists.
        if (source.prepared.shoppableThumbnails[index][cacheIndex]) {
            return source.prepared.shoppableThumbnails[index][cacheIndex];
        }

        // 5. If not cached, prepare the URL once.
        const tempSrc: SourceOptions = {
            src: 'https://dummyimage.com/400x225/000/fff&text=Loading+Thumbnail',
            poster: {
                src: imageUrl,
                transformation: this.getTransformation()
            }
        };

        const preparedUrl = await preparePosterSrc(tempSrc, (this.player_ as any).imagekitVideoPlayer().getPlayerOptions());

        // 6. Store the newly prepared URL in the cache and return it.
        source.prepared.shoppableThumbnails[index][cacheIndex] = preparedUrl;
        return preparedUrl;
    }

    createEl() {
        const prod = this.getItem();
        const el = document.createElement('a');
        el.className = 'vjs-shoppable-item';
        el.setAttribute('data-product-id', String(this.getItem().productId));

        const imageContainer = document.createElement('div');
        imageContainer.className = 'vjs-shoppable-image-container';
        el.appendChild(imageContainer);

        // spinner
        this.spinnerEl = document.createElement('div');
        this.spinnerEl.className = 'vjs-shoppable-item-spinner';
        // you can style this in your SCSS to show a CSS spinner
        imageContainer.appendChild(this.spinnerEl);

        this.getThumbnail()
            // FIX: Use an arrow function to preserve `this` context
            .then((url) => {
                if (!this.el_) {
                    return;
                }

                if (this.spinnerEl) {
                    this.spinnerEl.remove();
                }

                this.imgEl = document.createElement('img');
                this.imgEl.className = 'vjs-shoppable-item-img';
                this.imgEl.loading = 'lazy';
                this.imgEl.src = url;
                this.imgEl.alt = this.getItem().productName || '';
                imageContainer.appendChild(this.imgEl);

                if (prod.onHover?.action === 'switch' && prod.onHover.args?.url) {
                    this.getThumbnail(true)
                        .then((altUrl) => {
                            this.altImgEl = document.createElement('img');
                            this.altImgEl.className = 'vjs-shoppable-item-img vjs-shoppable-item-img-alt';
                            this.altImgEl.src = altUrl; // Use the prepared URL
                            this.altImgEl.alt = prod.productName || '';
                            this.altImgEl.loading = 'lazy';
                            this.altImgEl.setAttribute('aria-hidden', 'true');
                            imageContainer.appendChild(this.altImgEl);
                        })
                        .catch((err) => {
                            this.player_.log('Could not load alternate image for shoppable item.', err);
                        });
                }
            })
            .catch((err) => {
                if (!this.el_) {
                    return;
                }
                this.player_.log.error(`Failed to load poster for shoppable item: ${err.message}`);
                if (this.spinnerEl) {
                    this.spinnerEl.remove();
                }
                el.classList.add('vjs-shoppable-item-placeholder');
            });

        const info = document.createElement('div');
        info.className = 'vjs-shoppable-item-info';
        info.textContent = prod.productName;
        el.appendChild(info);

        // --- CHANGE: Centralized and improved onHover logic ---
        if (prod.onHover) {
            // If the action is 'overlay', create the overlay element ONCE and append it.
            // It will be hidden by default via CSS and shown on hover.
            if (prod.onHover.action === 'overlay' && prod.onHover.args) {
                const hoverOverlay = document.createElement('div');
                hoverOverlay.className = 'vjs-shoppable-item-overlay';
                hoverOverlay.textContent = prod.onHover.args;
                el.appendChild(hoverOverlay);
            }
        }

        return el;
    }
}



videojs.registerComponent('shoppablePanelItem', ShoppablePanelItem);

export default ShoppablePanelItem;

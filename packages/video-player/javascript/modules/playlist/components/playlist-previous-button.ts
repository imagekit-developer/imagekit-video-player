import PlaylistButton from './playlist-button';
import videojs from 'video.js';
import type Player from 'video.js/dist/types/player';


class PlaylistPreviousButton extends PlaylistButton {
  constructor(player: Player) {
    super(player, { type: 'previous' });
  }

  handleClick(event: Event) {
    event.stopPropagation();
    // @ts-ignore
    super.handleClick(event);
     // @ts-ignore
    this.player().imagekitVideoPlayer().getPlaylistManager().playPrevious();
  }
}

videojs.registerComponent('PlaylistPreviousButton', PlaylistPreviousButton);

export default PlaylistPreviousButton;

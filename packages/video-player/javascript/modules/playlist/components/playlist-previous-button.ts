import PlaylistButton from './playlist-button';
import videojs from 'video.js';
import type { Player } from '../../../interfaces/Player';


class PlaylistPreviousButton extends PlaylistButton {
  constructor(player: Player) {
    super(player, { type: 'previous' });
  }

  handleClick(event: Event) {
    event.stopPropagation();
    super.handleClick(event);
    const player = this.player() as Player;
    const playlistManager = player.imagekitVideoPlayer().getPlaylistManager();
    if (playlistManager) {
      playlistManager.playPrevious();
    }
  }
}

videojs.registerComponent('PlaylistPreviousButton', PlaylistPreviousButton);

export default PlaylistPreviousButton;

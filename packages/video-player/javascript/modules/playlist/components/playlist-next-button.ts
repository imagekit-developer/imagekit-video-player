import PlaylistButton from './playlist-button';
import videojs from 'video.js';
import type { Player } from '../../../interfaces/Player';


class PlaylistNextButton extends PlaylistButton {

  constructor(player: Player) {
    super(player, { type: 'next' });
  }
  
  handleClick(event: Event) {
    event.stopPropagation();
    super.handleClick(event);
    const player = this.player() as Player;
    const playlistManager = player.imagekitVideoPlayer().getPlaylistManager();
    if (playlistManager) {
      playlistManager.playNext();
    }
  }
}

videojs.registerComponent('PlaylistNextButton', PlaylistNextButton);

export default PlaylistNextButton;

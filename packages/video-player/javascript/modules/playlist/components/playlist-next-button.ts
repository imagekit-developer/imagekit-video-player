import PlaylistButton from './playlist-button';
import videojs from 'video.js';
import type Player from 'video.js/dist/types/player';


class PlaylistNextButton extends PlaylistButton {

  constructor(player: Player) {
    super(player, { type: 'next' });
  }
  
  handleClick(event: Event) {
    event.stopPropagation();
    // @ts-ignore
    super.handleClick(event);
     // @ts-ignore
     this.player().imagekitVideoPlayer().getPlaylistManager().playNext();
  }
}

videojs.registerComponent('PlaylistNextButton', PlaylistNextButton);

export default PlaylistNextButton;

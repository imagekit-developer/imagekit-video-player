// src/app/app.component.ts

import { Component, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IkVideoPlayerComponent } from '@imagekit/video-player/angular';
import type { PlayerOptions, SourceOptions, PlaylistOptions } from '@imagekit/video-player';
// import type Player from 'video.js/dist/types/player';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  standalone: true,
  imports: [
    CommonModule,
    IkVideoPlayerComponent,
  ],
})
export class AppComponent {
  // Use @ViewChild to get a reference to our component instance in the template.
  // This is the Angular equivalent of React's `useRef` for component instances.
  @ViewChild(IkVideoPlayerComponent) playerComponent?: IkVideoPlayerComponent;

  // Define component properties for player options and sources
  ikOptions: PlayerOptions = {
    imagekitId: 'YOUR_IMAGEKIT_ID', // Remember to replace this
    seekThumbnails: true,
    logo: {
      showLogo: true,
      logoImageUrl: 'https://ik.imgkit.net/ikmedia/logo/light_T4buIzohVH.svg',
      logoOnclickUrl: 'https://imagekit.io/',
    },
  };

  playlist: {
    sources: SourceOptions[];
    options?: PlaylistOptions;
  } = {
    sources: [
      {
        src: 'https://ik.imagekit.io/zuqlyov9d/SEO-friendly%20file%20names.mp4',
        info: { title: 'Dog', subtitle: 'Dog wearing cap', description: 'This is a video containing dog wearing cap.' }
      },
      {
        src: 'https://ik.imagekit.io/zuqlyov9d/example_video_2.mp4',
        info: { title: 'Human', subtitle: 'Human lying in grass', description: 'This is a video showing human lying on the grass.' },
      },
      {
        src: 'https://ik.imagekit.io/zuqlyov9d/sample-video.mp4',
        info: { title: 'Bird', subtitle: 'Bird on a branch', description: 'This video depicts bird chirping.' },
      },
    ],
    options: {
      autoAdvance: 5,
      repeat: true,
      presentUpcoming: 10,
    }
  };

  // Define styles as an object for [ngStyle]
  playerStyles = {
    width: '100%'
  };
}
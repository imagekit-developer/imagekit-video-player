==> ./tsconfig.app.json <==
/* To learn more about Typescript configuration file: https://www.typescriptlang.org/docs/handbook/tsconfig-json.html. */
/* To learn more about Angular compiler options: https://angular.dev/reference/configs/angular-compiler-options. */
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./out-tsc/app",
    "types": [
      "node"
    ]
  },
  "include": [
    "src/**/*.ts"
  ],
  "exclude": [
    "src/**/*.spec.ts"
  ]
}

==> ./angular.json <==
{
  "$schema": "./node_modules/@angular/cli/lib/config/schema.json",
  "version": 1,
  "newProjectRoot": "projects",
  "projects": {
    "my-angular-app": {
      "projectType": "application",
      "schematics": {
        "@schematics/angular:component": {
          "standalone": false
        },
        "@schematics/angular:directive": {
          "standalone": false
        },
        "@schematics/angular:pipe": {
          "standalone": false
        }
      },
      "root": "",
      "sourceRoot": "src",
      "prefix": "app",
      "architect": {
        "build": {
          "builder": "@angular-devkit/build-angular:browser",
          "options": {
            "outputPath": "dist/my-angular-app",
            "index": "src/index.html",
            "main": "src/main.ts",
            "polyfills": ["zone.js"],
            "tsConfig": "tsconfig.app.json",
            "assets": ["src/favicon.ico", "src/assets"],
            "styles": ["src/styles.css"],
            "scripts": []
          },
          "configurations": {
            "production": {
              "budgets": [
                {
                  "type": "initial",
                  "maximumWarning": "500kb",
                  "maximumError": "1mb"
                },
                {
                  "type": "anyComponentStyle",
                  "maximumWarning": "2kb",
                  "maximumError": "4kb"
                }
              ],
              "outputHashing": "all"
            },
            "development": {
              "buildOptimizer": false,
              "optimization": false,
              "vendorChunk": true,
              "extractLicenses": false,
              "sourceMap": true,
              "namedChunks": true
            }
          },
          "defaultConfiguration": "production"
        },
        "serve": {
          "builder": "@angular/build:dev-server",
          "configurations": {
            "production": {
              "buildTarget": "my-angular-app:build:production"
            },
            "development": {
              "buildTarget": "my-angular-app:build:development"
            }
          },
          "defaultConfiguration": "development"
        },
        "extract-i18n": {
          "builder": "@angular/build:extract-i18n"
        },
        "test": {
          "builder": "@angular/build:karma",
          "options": {
            "polyfills": ["zone.js", "zone.js/testing"],
            "tsConfig": "tsconfig.spec.json",
            "assets": [
              {
                "glob": "**/*",
                "input": "public"
              }
            ],
            "styles": ["src/styles.css"]
          }
        }
      }
    }
  }
}

==> ./package.json <==
{
  "name": "my-angular-app",
  "version": "0.0.0",
  "scripts": {
    "dev": "ng",
    "start": "ng serve",
    "build": "ng build",
    "watch": "ng build --watch --configuration development",
    "test": "ng test",
    "serve:ssr:my-angular-app": "node dist/my-angular-app/server/server.mjs"
  },
  "private": true,
  "dependencies": {
    "@angular/common": "^20.0.0",
    "@angular/compiler": "^20.0.0",
    "@angular/core": "^20.0.0",
    "@angular/forms": "^20.0.0",
    "@angular/platform-browser": "^20.0.0",
    "@angular/platform-server": "^20.0.0",
    "@angular/router": "^20.0.0",
    "@angular/ssr": "^20.0.1",
    "@imagekit/video-player": "workspace:*",
    "express": "^5.1.0",
    "rxjs": "~7.8.0",
    "tslib": "^2.3.0",
    "zone.js": "~0.15.0"
  },
  "devDependencies": {
    "@angular-devkit/build-angular": "^20.0.1",
    "@angular/build": "^20.0.1",
    "@angular/cli": "^20.0.1",
    "@angular/compiler-cli": "^20.0.0",
    "@types/express": "^5.0.1",
    "@types/jasmine": "~5.1.0",
    "@types/node": "^20.17.19",
    "jasmine-core": "~5.7.0",
    "karma": "~6.4.0",
    "karma-chrome-launcher": "~3.2.0",
    "karma-coverage": "~2.2.0",
    "karma-jasmine": "~5.1.0",
    "karma-jasmine-html-reporter": "~2.1.0",
    "typescript": "~5.8.2"
  }
}
==> ./tsconfig.json <==
/* To learn more about Typescript configuration file: https://www.typescriptlang.org/docs/handbook/tsconfig-json.html. */
/* To learn more about Angular compiler options: https://angular.dev/reference/configs/angular-compiler-options. */
{
  "compileOnSave": false,
  "compilerOptions": {
    "strict": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "experimentalDecorators": true,
    "importHelpers": true,
    "target": "ES2022",
    "module": "preserve"
  },
  "angularCompilerOptions": {
    "enableI18nLegacyMessageIdFormat": false,
    "strictInjectionParameters": true,
    "strictInputAccessModifiers": true,
    "typeCheckHostBindings": true,
    "strictTemplates": true
  },
  "files": [],
  "references": [
    {
      "path": "./tsconfig.app.json"
    },
    {
      "path": "./tsconfig.spec.json"
    }
  ]
}

==> ./tsconfig.spec.json <==
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./out-tsc/spec",
    "types": [
      "jasmine"
    ]
  },
  "include": [
    "src/**/*.ts"
  ]
}

==> ./src/index.html <==
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>MyAngularApp</title>
  <base href="/">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" type="image/x-icon" href="favicon.ico">
</head>
<body>
  <app-root></app-root>
</body>
</html>

==> ./src/app/app.component.html <==
<div style="max-width: 800px; margin: 2rem auto;">
    <h1>ImageKit Video Player (Angular) Example</h1>  
    <div style="margin-top: 1rem;">
      <ik-video-player
        [ikOptions]="ikOptions"
        [videoJsOptions]="{
          controls: true,
          fluid: true,
          muted: false
        }"
        [playlist]="playlist"
        [className]="'my-custom-player-container'"
        [ngStyle]="playerStyles"
      ></ik-video-player>
    </div>
  </div>

==> ./src/app/app.ts <==
import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  standalone: false,
  styleUrl: './app.css'
})
export class App {
  protected title = 'my-angular-app';
}

==> ./src/app/app.component.ts <==
// src/app/app.component.ts

import { Component, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common'; // <-- Import CommonModule for ngStyle
import { IkVideoPlayerComponent } from '@imagekit/video-player/angular';
import type { PlayerOptions, SourceOptions, PlaylistOptions } from '@imagekit/video-player';
// import type Player from 'video.js/dist/types/player';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  standalone: true, // <-- 1. Mark AppComponent as standalone
  imports: [
    CommonModule, // <-- 2. Import CommonModule for ngStyle
    IkVideoPlayerComponent, // <-- 3. Import your player component directly here
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
==> ./src/main.ts <==
// examples/angular/src/main.ts

import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent)
  .catch((err) => console.error(err));
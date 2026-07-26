# Pokimation

Pokimation turns a favorite photo into an anime-inspired interactive 3D memory. The app currently includes two complete examples: Golden Gate Pikachu and the Deep Blue “Big Fish” catch.

## Run locally

```bash
npm install
npm run dev
```

Open <http://127.0.0.1:4173/>.

Production check:

```bash
npm run build
```

## Experience flow

1. The home page presents a clear drag-and-drop image field.
2. JPG, PNG, and WEBP images up to 12 MB are accepted and kept in the browser. The supplied portrait fishing photo maps to Big Fish; the landscape card photo maps to Pikachu.
3. A particle portal transition moves the user into the interactive scene.
4. The original upload is shown uncropped in the memory panel.
5. The center stage supports orbit, zoom, Trainer / Duo / Partner focus, motion controls, and custom GLB animation playback.

## Scene asset contract

Production asset locations and scene-specific copy are controlled by `public/assets/scene-config.json`. Each scene provides its own original image, trainer and partner GLBs, background media, placement, metrics, moves, and labels:

```json
{
  "defaultScene": "bigFish",
  "scenes": {
    "bigFish": {
      "humanModel": "assets/models/human/big-fish-trainer.glb",
      "partnerModel": "assets/models/pokemon/big-fish.glb",
      "backgroundImage": "assets/backgrounds/deep-blue-boat.png"
    },
    "pikachu": {
      "humanModel": "assets/models/human/trainer-happy-jump.glb",
      "partnerModel": "assets/models/pokemon/pikachu.glb",
      "backgroundVideo": "assets/video/golden-gate-anime-v2.mp4"
    }
  }
}
```

The current production build includes:

- a textured Pikachu GLB generated with Meshy;
- a rigged human GLB with a 10-second `happy_jump` animation;
- the supplied textured fisherman and Big Fish Meshy GLBs;
- the supplied Deep Blue boat image as the static Big Fish scene background;
- the refreshed Golden Gate anime background video, optimized to 720p for the web;
- the supplied Golden Gate card photo as the featured original memory.
- the supplied transparent Poké Ball cover artwork on a dimensional, illuminated 3D stage.
- automatic GLB clip playback plus a procedural Pokémon idle/reaction system for static meshes.

The loader normalizes the models to the current stage, enables shadows, supports Draco-compressed geometry, applies optional Y-axis rotations from the config, and plays the first animation clip found in each GLB. The current Pikachu source mesh has no embedded skin or animation clip, so Pokimation adds polished root motion and electric reactions at runtime; a future rigged GLB will be picked up automatically. Procedural preview companions remain available as a graceful fallback if either model cannot load.

## Important files

```text
index.html                              # Upload and 3D experience structure
src/main.js                             # Upload flow, particles, asset loading, Three.js scene
src/styles.css                          # Responsive anime-inspired visual system
public/assets/scene-config.json         # Swappable final asset paths
public/assets/models/human/             # Human/trainer GLBs
public/assets/models/pokemon/           # Pokémon/partner GLBs
public/assets/original/                 # Featured original memory
public/assets/backgrounds/              # Static scene backgrounds
public/assets/stage/                    # Poké Ball stage artwork
public/assets/video/                    # Background video
public/draco/                           # Local Draco decoder
```

## Image privacy

Uploaded images are read through an in-memory browser object URL. The app does not upload them to a server or persist the image itself.

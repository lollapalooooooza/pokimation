# Pokimation

Pokimation turns a photo of someone holding a favorite Pokémon card into an anime-inspired interactive 3D memory. The current build establishes the complete experience and uses lightweight procedural companions until the final human model, Pokémon model, and background video are supplied.

## Run locally

```bash
npm install
npm run dev
```

Open <https://pokimation.vercel.app/>. click "Open the featured memory" to test if you don't have an image with pokemon card!

Production check:

```bash
npm run build
```

## Experience flow

1. The home page presents a clear drag-and-drop image field.
2. JPG, PNG, and WEBP images up to 12 MB are accepted and kept in the browser.
3. A particle portal transition moves the user into the interactive scene.
4. The original upload is shown uncropped in the memory panel.
5. The center stage supports orbit, zoom, Trainer / Duo / Partner focus, motion controls, and custom GLB animation playback.

## Final asset contract

Asset locations are controlled by `public/assets/scene-config.json`:

```json
{
  "humanModel": "assets/models/human/trainer.glb",
  "pokemonModel": "assets/models/pokemon/companion.glb",
  "backgroundVideo": "assets/video/pokimation-background.mp4"
}
```

The values are `null` in the initial build, so Pokimation uses its procedural preview companions and illustrated background. Once the final assets arrive:

- place the human GLB in `public/assets/models/human/`;
- place the Pokémon GLB in `public/assets/models/pokemon/`;
- place the MP4 or WEBM background in `public/assets/video/`;
- update the three paths in `scene-config.json`.

The loader normalizes the models to the current stage, enables shadows, supports Draco-compressed geometry, and plays the first animation clip found in each GLB.

## Important files

```text
index.html                              # Upload and 3D experience structure
src/main.js                             # Upload flow, particles, asset loading, Three.js scene
src/styles.css                          # Responsive anime-inspired visual system
public/assets/scene-config.json         # Swappable final asset paths
public/assets/models/human/             # Human/trainer GLBs
public/assets/models/pokemon/           # Pokémon/partner GLBs
public/assets/video/                    # Background video
public/draco/                           # Local Draco decoder
```

## Image privacy

Uploaded images are read through an in-memory browser object URL. The app does not upload them to a server or persist the image itself.

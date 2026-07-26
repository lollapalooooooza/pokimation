# Pokimation

Pokimation turns a photo of someone holding a favorite Pokémon card into an anime-inspired interactive 3D memory. The current build establishes the complete experience and uses lightweight procedural companions until the final human model, Pokémon model, and background video are supplied.

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
2. JPG, PNG, and WEBP images up to 12 MB are accepted and kept in the browser.
3. A particle portal transition moves the user into the interactive scene.
4. The original upload is shown uncropped in the memory panel.
5. The center stage supports orbit, zoom, Trainer / Duo / Partner focus, motion controls, and custom GLB animation playback.

## Final asset contract

Production asset locations are controlled by `public/assets/scene-config.json`:

```json
{
  "humanModel": "assets/models/human/trainer-happy-jump.glb",
  "humanRotationY": -0.7853981634,
  "pokemonModel": "assets/models/pokemon/pikachu.glb",
  "pokemonRotationY": -0.7853981634,
  "backgroundVideo": "assets/video/golden-gate-anime.mp4"
}
```

The current production build includes:

- a textured Pikachu GLB generated with Meshy;
- a rigged human GLB with a 10-second `happy_jump` animation;
- the supplied Golden Gate anime background video;
- the supplied Golden Gate card photo as the featured original memory.

The loader normalizes the models to the current stage, enables shadows, supports Draco-compressed geometry, applies optional Y-axis rotations from the config, and plays the first animation clip found in each GLB. Procedural preview companions remain available as a graceful fallback if either model cannot load.

## Important files

```text
index.html                              # Upload and 3D experience structure
src/main.js                             # Upload flow, particles, asset loading, Three.js scene
src/styles.css                          # Responsive anime-inspired visual system
public/assets/scene-config.json         # Swappable final asset paths
public/assets/models/human/             # Human/trainer GLBs
public/assets/models/pokemon/           # Pokémon/partner GLBs
public/assets/original/                 # Featured original memory
public/assets/video/                    # Background video
public/draco/                           # Local Draco decoder
```

## Image privacy

Uploaded images are read through an in-memory browser object URL. The app does not upload them to a server or persist the image itself.

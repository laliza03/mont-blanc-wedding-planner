# Mont-Blanc Wedding Planner

A browser-based 3D wedding decor simulator for **La Sirène Banquet – Salle Mont-Blanc**.

## Try the simulator

Open the [GitHub Pages site](https://laliza03.github.io/mont-blanc-wedding-planner/).

- **Decorate:** add florals, candles, arches, draped backdrops, vases, greenery, lanterns or an aisle runner. Each piece is a visible 3D object. Select a table or activity station first to place a small decoration on its tabletop.
- **Place a piece:** drag it in the room, or select it in the menu and adjust position, rotation, size and height. Decorations can be duplicated, individually coloured and removed. Pieces added to a tabletop follow that furniture when it moves, rotates or resizes; dragging or repositioning a piece independently detaches it. Placement stays within the room footprint; pieces can overlap, so inspect clearances yourself.
- **Colours:** choose one of five palettes, or edit accent, flower, metal, table linen, chair, wall, room floor and dance floor colours separately. Custom-coloured decorations keep their colour until you choose “Use palette colour.” Floral fullness includes a zero-flower setting. Colour and fullness changes preserve object positions and guest assignments.
- **Views:** orbit, top, window side, two guest views and the couple's view. Near walls cut away automatically in exterior views. Turn off “Move pieces” to orbit freely when dragging over furniture. Toggle labels and walls independently.
- **Seating:** 8–10 tables and 1–120 total seats. Updating seats retains surviving table transforms. Full tables cannot be overbooked; guests displaced by a reduced capacity or removed table become unassigned.
- **Stations:** toggle the photo booth, Polaroid scrapbook, video-message, advice, cake/sweets and DJ stations. Hidden stations keep their placement.
- **Budget:** track shopping items, prices, quantities and product links. The shopping list is separate from the visual decoration library.
- **Save:** save/load in the current browser, export/import a JSON plan, or download a PNG of the current room view. Exported plans retain decorations, per-piece colours, room colours, transforms, station visibility, guests, shopping items and display settings. Version 3 plans from the original planner are supported. Invalid imports leave the current room intact.

On phones, the room opens full-screen; tap **Planner** to open the controls, then close the panel to see the result. There is no server-side storage. Export a JSON file to keep a backup or move a plan between browsers/devices. Furniture arrangements are not automatically saved; use **Save** or **Export JSON**.

## Run locally

Python 3 can serve the static source without installing dependencies:

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

Open `http://127.0.0.1:4173`. Use HTTP rather than opening `index.html` directly, since the app uses JavaScript modules.

Optional Node.js commands (Node 22 or later):

```sh
npm test
npm run build
```

The build copies just the website files into `dist/`. GitHub Actions runs the tests before publishing `dist/` to GitHub Pages on pushes to `main`. Pull requests run the same checks without deploying.

## Venue reference

The supplied Mont-Blanc floor plan specifies 35 ft maximum width, 62 ft total length, a 27 ft lower width with an 8 ft entry recess, 12.5 ft ceiling height, 1,930 ft² listed area and a banquet capacity of 120. One Three.js world unit represents one foot. The floor footprint and walls share the same coordinate system; the wide end is negative Z and the recessed end positive Z.

The exit opening and dotted central dance area are positioned approximately from the supplied diagram. Windows, curtains, chandeliers, furniture and decorations are visual approximations. This simulator does not calculate aisle widths, collisions, accessibility, fire egress or real-world fit. Confirm final measurements and clearances with the venue.

## Dependencies

Three.js **0.167.1** and its OrbitControls are bundled locally in `vendor/three/`, with their MIT license. The simulator does not require a CDN connection or an npm install to start. Native ES modules, import maps and WebGL are required. If graphics startup fails, the page displays a recovery message.

## Validation

`npm test` covers seat distribution, version 3 compatibility, complete version 4 JSON round trips, hidden stations, malformed imports, numeric and colour validation, guest capacity and safe product links. Manual browser QA covers all decoration types, drag placement, individual and room colours, save/load, import/export, image export and narrow/mobile layouts.

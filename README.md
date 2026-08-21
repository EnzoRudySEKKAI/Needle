# Needle

Needle is a shared LAN builder for interactive ontology maps. It turns concepts into an isometric city, relations into routed paths, and scenarios into animated payload flows.

## Features

- Isometric ontology editor with measurable building geometry
- Ten building forms and optional hatched facades
- Neighborhoods, typed relations, properties, and animated scenarios
- Light and dark themes
- Live LAN persistence with local undo and redo
- SVG, high-resolution PNG, and PDF exports
- Presentation mode at `/map/:id`

## Development

```bash
npm install
npm run dev
```

Open `http://localhost:5173` on the host or the printed network URL on another computer. The development command starts Vite, the shared map API, and live WebSocket synchronization on the same port.

To serve the production build on port 4173:

```bash
npm run build
npm run preview
```

## Verification

```bash
npm run build
npm run lint
npm run test
```

## Storage

Shared maps are stored as atomic JSON documents under `.needle-data/maps/` on the host. Updates are broadcast to connected browsers with last-write-wins semantics. Existing browser-local maps can be published from the LAN atlas migration action; schema migrations remain automatic.

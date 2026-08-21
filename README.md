# Needle

Needle is a local-first builder for interactive ontology maps. It turns concepts into an isometric city, relations into routed paths, and scenarios into animated payload flows.

## Features

- Isometric ontology editor with measurable building geometry
- Ten building forms and optional hatched facades
- Neighborhoods, typed relations, properties, and animated scenarios
- Light and dark themes
- Local browser persistence with undo and redo
- SVG, high-resolution PNG, and PDF exports
- Presentation mode at `/map/:id`

## Development

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## Verification

```bash
npm run build
npm run lint
npm run test
```

## Storage

Maps are stored in the browser's local storage. The current schema is versioned and automatically migrates older local documents.

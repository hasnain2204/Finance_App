# Technical Stack

## Approved stack
- React
- JavaScript
- Vite
- Dexie.js
- IndexedDB
- PWA support via Vite PWA tooling
- Optional Capacitor later for Android packaging

## Rationale
- React provides a simple and maintainable UI structure for a mobile-first finance app.
- JavaScript is the approved language for this project.
- Vite is the approved build and local dev tool.
- Dexie.js is a practical, low-complexity layer over IndexedDB for local-first data storage.
- PWA support is appropriate for the installable/offline-first product requirement.

## Explicit exclusions
- Supabase and remote sync are deferred to a future phase.
- Additional large UI or state libraries are not approved unless a specific requirement requires them.

## Current status
- Stack approval is confirmed from product requirements.
- A React/Vite implementation and PWA build configuration are present.
- Dexie is used for local persistence; installation and offline behavior still require validation.

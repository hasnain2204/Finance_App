# Architecture

## High-level pattern
Presentation layer -> feature logic/data-access -> Dexie -> IndexedDB

## Recommended responsibilities
- React components: rendering, interaction handling, user interface composition
- Feature services: transaction creation, update, deletion, validation, totals, analytics, budget checks
- Dexie database layer: schema definition, CRUD operations, migrations
- Utility functions: PKR formatting, date handling, validation, conversion logic

## Local-first design principle
- The browser local database is the source of truth for V1.
- The app should be usable without internet access after installation and local caching have been configured.
- No remote data layer is required for V1.

## Remaining design dependency
- The final UI screen architecture depends on the approved Figma section and screen exports.

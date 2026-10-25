# Architecture

## High-level pattern
React UI -> finance repository -> Dexie -> IndexedDB

## Recommended responsibilities
- React components: rendering, interaction handling, user interface composition; no direct database access
- Finance repository: application data access, CRUD operations, and atomic multi-record operations
- Dexie database layer: IndexedDB schema definition and migrations
- Utility functions: PKR formatting, date handling, validation, conversion logic

The repository is the persistence boundary for the current web/PWA adapter. It wraps the existing Dexie database and preserves its schema, keys, and IndexedDB behavior. Future adapters can implement the same repository operations for native Android SQLite or a cloud API without coupling those changes to React components. Supabase/PostgreSQL synchronization is future work and is not part of the current persistence implementation.

## Local-first design principle
- The browser local database is the source of truth for V1.
- The app should be usable without internet access after installation and local caching have been configured.
- No remote data layer is required for V1.

## Remaining design dependency
- The final UI screen architecture depends on the approved Figma section and screen exports.

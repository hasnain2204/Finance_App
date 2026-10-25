# Services

`financeRepository.js` is the application persistence boundary. It currently wraps Dexie/IndexedDB for the web/PWA and owns database reads, writes, and atomic multi-record operations. React components should use the repository rather than importing the database directly.

Future native SQLite and cloud synchronization adapters can be introduced behind this boundary in separate phases. They are not implemented here.

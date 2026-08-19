#!/usr/bin/env node
// Launcher for the wave-runtime-mcp bin — dist/server.js has no shebang (tsc emits none),
// so the bin must be this shebang-carrying wrapper. Dynamic import keeps the ESM graph intact.
import('../dist/server.js');

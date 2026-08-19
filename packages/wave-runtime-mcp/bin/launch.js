#!/usr/bin/env node
// Launcher for the wave-runtime-mcp bin. dist/server.js is importable (tests drive runServer
// directly); this file IS the entry point, so it wires stdio unconditionally.
import { runServer } from '../dist/server.js';
import process from 'node:process';
runServer(process.stdin, process.stdout);

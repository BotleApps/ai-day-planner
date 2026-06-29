#!/usr/bin/env bash
# Launch the AI Day Planner Dev Console (visual control panel for the
# run-local / deploy / npm scripts). Opens in your browser automatically.
cd "$(dirname "$0")"
exec node dev-console/server.js

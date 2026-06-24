# 0002: Auto-deploy main after CI passes

Pushes to `main` deploy automatically to the VPS, but only after dependency installation, tests, and production builds complete successfully in GitHub Actions. This keeps early production shipping fast while preventing obviously broken commits from reaching the server.

# 0029: Keep shared types for API contracts

The TanStack Start dashboard imports shared request, response, and domain types from `libs/data` instead of hand-writing duplicate frontend API types. NestJS remains the API owner, and `libs/data` remains the shared contract boundary between backend and frontend.

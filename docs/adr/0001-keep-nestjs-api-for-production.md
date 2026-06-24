# 0001: Keep NestJS API as the production backend

## Status

Accepted

## Context

The project already has a NestJS API with authentication, RBAC, task management, audit logging, AI chat, reports, TypeORM entities, migrations, and shared TypeScript contracts used by the Angular dashboard.

The team wants to learn Go, but shipping the product to production is more important than rewriting the backend for language-learning purposes.

## Decision

Keep `apps/api` as the primary production backend.

Do not rewrite the whole backend in Go before launch. Introduce Go later only at a narrow backend boundary where isolation is useful, such as an async worker, AI/task intelligence service, or another service with a small contract and low coupling to the dashboard.

## Consequences

Production work can focus on hardening the existing API instead of rediscovering existing behavior in a new stack.

The Angular dashboard can continue using the existing TypeScript contracts.

Go can still be introduced deliberately after the production path is stable, with contract tests and a clear ownership boundary.

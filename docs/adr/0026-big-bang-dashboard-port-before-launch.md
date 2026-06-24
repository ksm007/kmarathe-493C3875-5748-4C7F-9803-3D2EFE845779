# 0026: Big-bang dashboard port before launch

The dashboard will be ported from Angular to React with TanStack Start before public launch, rather than migrated incrementally after launch. During the port, NestJS remains the backend API and the Angular dashboard is treated as the behavior reference for feature parity.

This increases short-term delivery risk, so the port must be constrained: no core backend rewrite, no new product scope beyond the agreed SaaS v1 requirements, and no launch until the TanStack Start dashboard reaches parity for authentication, active organization selection, task board, team management, invites, sprints, issues, AI chat, reports, and audit/admin views.

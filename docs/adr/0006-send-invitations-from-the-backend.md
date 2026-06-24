# 0006: Send invitations from the backend

Invitation emails are sent by the backend, not directly by the frontend. The backend creates the invitation, stores only a protected token representation, enforces expiry and single-use behavior, records audit history, and sends the email through a transactional email provider.

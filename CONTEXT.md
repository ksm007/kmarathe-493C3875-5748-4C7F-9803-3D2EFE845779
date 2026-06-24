# Turbo Vets

Turbo Vets is a multi-organization task management SaaS for teams that need scoped work tracking, collaboration, and auditability.

## Language

**User**:
A human identity that can sign in to the product. A User can belong to more than one Organization through Memberships.
_Avoid_: Account

**Organization**:
A tenant workspace that owns tasks, team configuration, workflow state, and audit history.
_Avoid_: Company, org account

**Membership**:
The relationship between a User and an Organization. A Membership carries that user's role and access within one Organization.
_Avoid_: User role, team member record

**Active Organization**:
The Organization currently selected for a signed-in User. Requests that read or mutate tenant data operate within this selected Organization.
_Avoid_: Current account, selected company

**Invitation**:
A time-limited offer for an email address to create or join a Membership in an Organization.
_Avoid_: Invite email, signup link

**Invitation Token**:
A secret value that proves the holder can accept an Invitation. The product stores a non-reversible representation of the token and treats the raw token as sensitive.
_Avoid_: Invite code

**Backlog**:
The ordered set of tasks in an Organization that are not assigned to an active or planned Sprint.
_Avoid_: Unassigned sprint, task pool

**Sprint**:
A timeboxed planning period that groups tasks an Organization intends to work on together.
_Avoid_: Iteration, milestone

**Sprint State**:
The lifecycle state of a Sprint: planned, active, or completed.
_Avoid_: Sprint status

**Plan**:
The product tier assigned to an Organization. A Plan defines usage limits such as member count and AI usage.
_Avoid_: Subscription, package

**Free Plan**:
The starting Plan for new Organizations. It allows up to 20 Members, 3 AI calls per User per day, 1 active Sprint, 5 planned Sprints, and 500 open Tasks.
_Avoid_: Trial

**Seat**:
A capacity unit on a Plan. Accepted Memberships and pending Invitations both consume Seats.
_Avoid_: License

**Password Reset**:
A time-limited flow that lets a User set a new password after proving control of their email address.
_Avoid_: Forgot password email

**Password Reset Token**:
A single-use secret value that authorizes a Password Reset for 30 minutes. The product stores a non-reversible representation of the token and treats the raw token as sensitive.
_Avoid_: Reset code

**Rate Limit**:
A product or security limit that caps how often a User, email address, IP address, or Organization can perform an action in a time window.
_Avoid_: Throttle

**Optimistic Reorder**:
A board interaction where task position changes appear immediately in the client while the server confirms the new order in the background. Failed updates roll back to the prior order.
_Avoid_: Instant drag

**Task Workflow**:
The ordered states a Task moves through on the board: backlog, to do, in progress, in review, and done.
_Avoid_: Custom workflow, status list

**Issue Type**:
The fixed classification of work represented by a Task: task, bug, story, or epic.
_Avoid_: Custom issue type

**Epic**:
An Issue Type that groups child tasks, bugs, or stories around a larger outcome. Epics do not belong to Sprints directly; their child issues do.
_Avoid_: Parent task

**Story Points**:
An optional estimate of issue size used for sprint planning and reporting.
_Avoid_: Hours, effort score

**Sprint Capacity**:
An optional story-point target for a Sprint used to compare committed work against planned team capacity.
_Avoid_: Sprint hours, velocity

**Acceptance Criteria**:
A checklist of conditions that describe what must be true for an issue to be considered complete.
_Avoid_: Test cases

**Issue Activity**:
The visible history of comments and meaningful changes on an issue.
_Avoid_: Audit log

**Image Attachment**:
An image file attached to an issue for collaboration context. Image attachments are limited to safe image formats and consume Organization storage.
_Avoid_: File attachment

**Storage Limit**:
The amount of attachment storage available to an Organization under its Plan.
_Avoid_: Upload quota

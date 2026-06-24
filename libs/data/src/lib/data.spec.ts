import { IssueType, Permission, Role, TaskStatus } from '../index';

describe('data library', () => {
  it('exposes stable enums for shared contracts', () => {
    expect(Role.Owner).toBe('owner');
    expect(Permission.TaskRead).toBe('task:read');
    expect(TaskStatus.Backlog).toBe('backlog');
    expect(TaskStatus.InProgress).toBe('in_progress');
    expect(TaskStatus.InReview).toBe('in_review');
    expect(IssueType.Epic).toBe('epic');
  });
});

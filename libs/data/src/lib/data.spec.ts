import { Permission, Role, TaskStatus } from '../index';

describe('data library', () => {
  it('exposes stable enums for shared contracts', () => {
    expect(Role.Owner).toBe('owner');
    expect(Permission.TaskRead).toBe('task:read');
    expect(TaskStatus.InProgress).toBe('in_progress');
  });
});

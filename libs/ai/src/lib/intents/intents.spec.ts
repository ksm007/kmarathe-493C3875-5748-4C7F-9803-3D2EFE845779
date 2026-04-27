import { parseIntent } from './intents';

describe('parseIntent — title/description extraction', () => {
  it('extracts title and description from "title of task as X and description of task as Y"', () => {
    const result = parseIntent(
      'a task with high priority and title of task as security update and description of task as update the security for auth',
    );
    expect(result.intent).toBe('create_task');
    expect(result.mutation.title).toBe('security update');
    expect(result.mutation.description).toBe('update the security for auth');
    expect(result.mutation.priority).toBe('high');
  });

  it('extracts title and description from "title as X and description as Y"', () => {
    const result = parseIntent(
      'create a task with title as Fix login bug and description as users cannot log in with high priority',
    );
    expect(result.mutation.title).toBe('Fix login bug');
    expect(result.mutation.description).toBe('users cannot log in');
    expect(result.mutation.priority).toBe('high');
  });

  it('falls back to simple title when no explicit title clause', () => {
    const result = parseIntent('add a new task to write unit tests');
    expect(result.intent).toBe('create_task');
    expect(result.mutation.title).toBeTruthy();
    expect(result.mutation.title).not.toContain('description');
  });

  it('does not bleed priority words into title', () => {
    const result = parseIntent('create a high priority task named Security patch');
    expect(result.mutation.title).not.toMatch(/high|priority/i);
    expect(result.mutation.priority).toBe('high');
  });
});

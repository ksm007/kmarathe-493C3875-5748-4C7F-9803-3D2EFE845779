import { TaskCategory, TaskPriority, TaskStatus } from '@nx-temp/data';

export type ChatIntent = 'query' | 'create_task' | 'update_task' | 'delete_task' | 'unknown';

export interface ParsedTaskMutation {
  title?: string;
  description?: string | null;
  category?: TaskCategory;
  priority?: TaskPriority;
  status?: TaskStatus;
  dueDate?: string | null;
  tags?: string[];
}

export interface IntentParseResult {
  intent: ChatIntent;
  mutation: ParsedTaskMutation;
  targetTaskHint: string | null;
}

export function classifyIntent(message: string): ChatIntent {
  const normalized = message.toLowerCase();

  if (/\b(delete|remove|archive)\b/.test(normalized)) {
    return 'delete_task';
  }

  if (/\b(create|add|new|remind me to)\b/.test(normalized)) {
    return 'create_task';
  }

  if (/\b(update|change|rename|move|mark|set)\b/.test(normalized)) {
    return 'update_task';
  }

  if (normalized.length < 4) {
    return 'unknown';
  }

  return 'query';
}

export function parseIntent(message: string): IntentParseResult {
  const intent = classifyIntent(message);
  const normalized = message.trim();
  const mutation: ParsedTaskMutation = {};
  const targetTaskHint = extractTaskHint(normalized);

  if (intent === 'create_task') {
    mutation.title = extractTitle(normalized) ?? 'New task';
    mutation.category = inferCategory(normalized);
    mutation.priority = inferPriority(normalized);
    mutation.status = inferStatus(normalized) ?? TaskStatus.Todo;
    mutation.dueDate = inferDueDate(normalized);
    mutation.tags = inferTags(normalized);
  }

  if (intent === 'update_task') {
    mutation.status = inferStatus(normalized);
    mutation.priority = inferPriority(normalized);
    mutation.dueDate = inferDueDate(normalized);
    mutation.tags = inferTags(normalized);
  }

  return {
    intent,
    mutation,
    targetTaskHint,
  };
}

function extractTitle(message: string): string | null {
  const patterns = [
    /(?:create|add|new task|remind me to)\s+(?:a\s+task\s+to\s+)?(.+)/i,
    /task to\s+(.+)/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]) {
      return cleanupTitle(match[1]);
    }
  }

  return null;
}

function extractTaskHint(message: string): string | null {
  const quoted = message.match(/"([^"]+)"/);
  if (quoted?.[1]) {
    return quoted[1];
  }

  const taskIdMatch = message.match(/\btask[-\s]?([a-z0-9-]+)/i);
  if (taskIdMatch?.[0]) {
    return cleanupText(taskIdMatch[0]);
  }

  return null;
}

function inferCategory(message: string): TaskCategory {
  if (/\b(home|personal|family)\b/i.test(message)) {
    return TaskCategory.Personal;
  }

  if (/\b(infra|ops|incident|deploy)\b/i.test(message)) {
    return TaskCategory.Ops;
  }

  return TaskCategory.Work;
}

function inferPriority(message: string): TaskPriority {
  if (/\b(critical|urgent|p0|high priority)\b/i.test(message)) {
    return TaskPriority.High;
  }

  if (/\b(low priority|later|someday)\b/i.test(message)) {
    return TaskPriority.Low;
  }

  return TaskPriority.Medium;
}

function inferStatus(message: string): TaskStatus | undefined {
  if (/\b(done|completed|finish|finished|close|closed)\b/i.test(message)) {
    return TaskStatus.Done;
  }

  if (/\b(start|in progress|working on|doing)\b/i.test(message)) {
    return TaskStatus.InProgress;
  }

  if (/\b(todo|to do|backlog)\b/i.test(message)) {
    return TaskStatus.Todo;
  }

  return undefined;
}

function inferDueDate(message: string): string | null {
  const isoMatch = message.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (isoMatch?.[1]) {
    return isoMatch[1];
  }

  const now = new Date();
  if (/\btomorrow\b/i.test(message)) {
    now.setDate(now.getDate() + 1);
    return now.toISOString().slice(0, 10);
  }

  if (/\btoday\b/i.test(message)) {
    return now.toISOString().slice(0, 10);
  }

  return null;
}

function inferTags(message: string): string[] {
  const tags = Array.from(message.matchAll(/#([a-z0-9_-]+)/gi)).map((match) => match[1]);
  return Array.from(new Set(tags));
}

function cleanupText(value: string): string {
  return value.replace(/[.?!]+$/, '').trim();
}

function cleanupTitle(value: string): string {
  return cleanupText(
    value
      .replace(/\s+(and\s+)?add it to\s+(the\s+)?in progress\b.*$/i, '')
      .replace(/\s+(and\s+)?mark it as\s+(the\s+)?in progress\b.*$/i, '')
      .replace(/\s+(and\s+)?set (the )?status to\s+[a-z_\s-]+\b.*$/i, '')
      .replace(/\s+(and\s+)?put it in\s+[a-z_\s-]+\b.*$/i, '')
  );
}

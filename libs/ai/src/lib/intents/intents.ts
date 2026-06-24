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

  // Explicit create signals, including "a task with title/description as"
  if (/\b(create|add|new|remind me to)\b/.test(normalized)) {
    return 'create_task';
  }

  if (/\ba\s+task\s+with\b/.test(normalized) && /\btitle\s+(?:of\s+(?:the\s+)?task\s+)?(?:as|:)/.test(normalized)) {
    return 'create_task';
  }

  // Only classify as update if "update/change/..." appears as a standalone verb,
  // not inside a quoted title phrase like "title as security update"
  const withoutTitleClause = normalized.replace(/\btitle\s+(?:of\s+(?:the\s+)?task\s+)?(?:as|:)\s+.+?(?=\s+and\s+|\s+description\s+|$)/gi, '');
  if (/\b(update|change|rename|move|mark|set)\b/.test(withoutTitleClause)) {
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
    mutation.description = extractDescription(normalized) ?? null;
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
  // Explicit "title as X" or "title of task as X" — highest priority
  const explicit = message.match(/\btitle\s+(?:of\s+(?:the\s+)?task\s+)?(?:as|:)\s+(.+?)(?=\s+and\s+description|\s+description\s+(?:of|as)|\s+with\s+(?:high|low|medium|critical|urgent)\s+priority|$)/i);
  if (explicit?.[1]) {
    return cleanupTitle(explicit[1]);
  }

  // Strip description/priority clauses then pull what follows the create verb
  const stripped = message
    .replace(/\s+(?:and\s+)?description\s+(?:of\s+(?:the\s+)?task\s+)?(?:as|:)\s+.+?(?=\s+with\s+|$)/gi, '')
    .replace(/\s+with\s+(?:high|low|medium|critical|urgent)\s+priority\b/gi, '')
    .replace(/\s+(?:high|low|medium|critical|urgent)\s+priority\b/gi, '');

  const patterns = [
    /task to\s+(.+)/i,
    /(?:create|add|new task|remind me to)\s+(?:a\s+task\s+(?:with\s+\w+\s+priority\s+)?(?:and\s+)?(?:titled?|called?|named?)\s+)?(.+)/i,
    /task\s+(?:titled?|called?|named?)\s+(.+)/i,
  ];

  for (const pattern of patterns) {
    const match = stripped.match(pattern);
    if (match?.[1]) {
      return cleanupTitle(match[1]);
    }
  }

  return null;
}

function extractDescription(message: string): string | null {
  const match = message.match(/\bdescription\s+(?:of\s+(?:the\s+)?task\s+)?(?:as|:)\s+(.+?)(?=\s+with\s+(?:high|low|medium|critical|urgent)\s+priority\b|$)/i);
  return match?.[1] ? cleanupText(match[1]) : null;
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
  if (/\b(critical|urgent|p0|high\s*priority|priority\s*high|\bhigh\b)\b/i.test(message)) {
    return TaskPriority.High;
  }

  if (/\b(low\s*priority|priority\s*low|later|someday|\blow\b)\b/i.test(message)) {
    return TaskPriority.Low;
  }

  if (/\b(medium\s*priority|priority\s*medium|\bmedium\b)\b/i.test(message)) {
    return TaskPriority.Medium;
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
      .replace(/\s+(?:and\s+)?description\s+(?:of\s+(?:the\s+)?task\s+)?(?:as|:)\s+.+$/i, '')
      .replace(/\s+(?:and\s+)?add it to\s+(the\s+)?in progress\b.*$/i, '')
      .replace(/\s+(?:and\s+)?mark it as\s+(the\s+)?in progress\b.*$/i, '')
      .replace(/\s+(?:and\s+)?set (the )?status to\s+[a-z_\s-]+\b.*$/i, '')
      .replace(/\s+(?:and\s+)?put it in\s+[a-z_\s-]+\b.*$/i, '')
      .replace(/\s+with\s+(?:high|low|medium|critical|urgent)\s+priority\b.*$/i, '')
      .replace(/\s+(?:high|low|medium|critical|urgent)\s+priority\b.*$/i, '')
      .replace(/\s+a\s+task\s+(with\s+)?/i, ' ')
      .trim()
  );
}

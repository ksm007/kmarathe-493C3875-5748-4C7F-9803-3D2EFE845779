const PROMPT_INJECTION_PATTERNS = [
  /ignore (all|the) previous instructions/gi,
  /reveal (the )?(system|hidden) prompt/gi,
  /print.*canary/gi,
  /disregard (all|previous)/gi,
];

export function sanitizeUserInput(input: string): string {
  let sanitized = input;

  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[filtered]');
  }

  return sanitized.trim();
}

export function detectPromptInjection(input: string): boolean {
  return PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(input));
}

export function hasCanaryLeak(output: string, canaryToken: string): boolean {
  return Boolean(canaryToken) && output.includes(canaryToken);
}

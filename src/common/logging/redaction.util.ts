const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /token/i,
  /secret/i,
  /authorization/i,
  /cookie/i,
  /api[-_]?key/i,
  /refresh/i,
];

const REDACTED = '[REDACTED]';
const CIRCULAR = '[Circular]';
const MAX_DEPTH_REACHED = '[MaxDepthReached]';

export function redactSensitiveData<T>(input: T, maxDepth = 8): unknown {
  const seen = new WeakSet<object>();
  return sanitize(input, seen, 0, maxDepth);
}

function sanitize(
  value: unknown,
  seen: WeakSet<object>,
  depth: number,
  maxDepth: number,
): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (depth > maxDepth) {
    return MAX_DEPTH_REACHED;
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Buffer.isBuffer(value)) {
    return `[Buffer:${value.length}]`;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitize(item, seen, depth + 1, maxDepth));
  }

  if (typeof value === 'object') {
    if (seen.has(value)) {
      return CIRCULAR;
    }
    seen.add(value);

    const source = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(source)) {
      if (isSensitiveKey(key)) {
        output[key] = REDACTED;
        continue;
      }

      output[key] = sanitize(item, seen, depth + 1, maxDepth);
    }

    return output;
  }

  if (typeof value === 'symbol') {
    return value.toString();
  }

  if (typeof value === 'function') {
    return '[Function]';
  }

  return '[UnserializableValue]';
}

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

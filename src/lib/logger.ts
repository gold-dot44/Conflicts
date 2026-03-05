/**
 * Structured JSON logger for server-side code (#18).
 *
 * Outputs JSON lines in production for easy ingestion by Azure Monitor,
 * Datadog, etc. Falls back to human-readable format in development.
 */

type LogLevel = "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

const IS_PRODUCTION =
  process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";

function write(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  };

  if (IS_PRODUCTION) {
    const line = JSON.stringify(entry);
    if (level === "error") {
      process.stderr.write(line + "\n");
    } else {
      process.stdout.write(line + "\n");
    }
  } else {
    // Human-readable in dev
    const prefix = `[${entry.timestamp}] ${level.toUpperCase()}:`;
    const extra = meta ? ` ${JSON.stringify(meta)}` : "";
    if (level === "error") {
      console.error(`${prefix} ${message}${extra}`);
    } else if (level === "warn") {
      console.warn(`${prefix} ${message}${extra}`);
    } else {
      console.log(`${prefix} ${message}${extra}`);
    }
  }
}

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => write("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => write("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>) => write("error", message, meta),
};

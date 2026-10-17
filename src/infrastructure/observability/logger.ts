const LEVELS = ["fatal", "error", "warn", "info", "debug", "trace"] as const;
type Level = (typeof LEVELS)[number];

function effectiveLevel(): Level {
  const raw = process.env.LOG_LEVEL;
  return (LEVELS as readonly string[]).includes(raw ?? "") ? (raw as Level) : "info";
}

const ORDER: Record<Level, number> = {
  fatal: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
  trace: 5,
};

function emit(level: Level, message: string): void {
  if (ORDER[level] > ORDER[effectiveLevel()]) return;
  const line = {
    t: new Date().toISOString(),
    level,
    msg: message,
  };
  if (level === "error" || level === "fatal") {
    console.error(JSON.stringify(line));
  } else {
    console.log(JSON.stringify(line));
  }
}

/** Minimal structured logger: one JSON line per event. */
export const log = {
  fatal: (message: string) => emit("fatal", message),
  error: (message: string) => emit("error", message),
  warn: (message: string) => emit("warn", message),
  info: (message: string) => emit("info", message),
  debug: (message: string) => emit("debug", message),
};

export type Logger = typeof log;
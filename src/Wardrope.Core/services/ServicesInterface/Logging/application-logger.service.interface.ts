export type LogFieldValue = string | number | boolean | null;
export type LogFields = Record<string, LogFieldValue>;

export interface IApplicationLogger {
  info(event: string, fields?: LogFields): void;
  warn(event: string, fields?: LogFields): void;
  error(event: string, fields?: LogFields): void;
}

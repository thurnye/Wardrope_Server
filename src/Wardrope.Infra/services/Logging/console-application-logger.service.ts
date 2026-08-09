import type {
  IApplicationLogger,
  LogFields,
} from '../../../Wardrope.Core/services/ServicesInterface/Logging/application-logger.service.interface';

function payload(event: string, fields?: LogFields) {
  return fields ? { event, ...fields } : { event };
}

export class ConsoleApplicationLogger implements IApplicationLogger {
  info(event: string, fields?: LogFields): void {
    console.info(payload(event, fields));
  }

  warn(event: string, fields?: LogFields): void {
    console.warn(payload(event, fields));
  }

  error(event: string, fields?: LogFields): void {
    console.error(payload(event, fields));
  }
}

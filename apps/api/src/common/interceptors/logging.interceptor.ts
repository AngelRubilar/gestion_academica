import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext('HTTP');
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{ method: string; url: string }>();
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        this.logger.debug({
          method: req.method,
          url: req.url,
          ms: Date.now() - start,
          status: 'ok',
        });
      }),
      catchError((err: unknown) => {
        if (err instanceof HttpException) {
          this.logger.warn({
            method: req.method,
            url: req.url,
            ms: Date.now() - start,
            status: 'err',
            code: err.getStatus(),
          });
        } else {
          this.logger.error({
            method: req.method,
            url: req.url,
            ms: Date.now() - start,
            status: 'err',
            err,
          });
        }
        return throwError(() => err);
      }),
    );
  }
}

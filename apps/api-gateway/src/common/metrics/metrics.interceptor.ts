import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const request = http.getRequest();
    const response = http.getResponse();
    const startedAt = process.hrtime.bigint();

    return next.handle().pipe(
      finalize(() => {
        const path = request?.route?.path ?? request?.originalUrl ?? 'unknown';
        if (path === '/metrics') {
          return;
        }

        const durationSeconds =
          Number(process.hrtime.bigint() - startedAt) / 1e9;
        const status = response?.statusCode ?? 200;
        const method = request?.method ?? 'UNKNOWN';

        this.metricsService.recordRequest({
          method,
          route: path,
          status,
          durationSeconds,
        });
      }),
    );
  }
}

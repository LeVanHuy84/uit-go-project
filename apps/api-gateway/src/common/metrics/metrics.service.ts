import { Injectable } from '@nestjs/common';

type MetricKey = string;

interface RequestMetric {
  method: string;
  route: string;
  status: number;
  durationSeconds: number;
}

@Injectable()
export class MetricsService {
  private readonly requestCounts = new Map<MetricKey, number>();
  private readonly requestDurations = new Map<MetricKey, number[]>();

  private readonly buckets = [
    0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5,
  ];

  recordRequest(metric: RequestMetric) {
    const key = this.formatLabels(metric.method, metric.route, metric.status);
    this.requestCounts.set(key, (this.requestCounts.get(key) ?? 0) + 1);

    const durations = this.requestDurations.get(key) ?? [];
    durations.push(metric.durationSeconds);
    this.requestDurations.set(key, durations);
  }

  render(): string {
    const lines: string[] = [];

    lines.push('# HELP http_requests_total Total number of HTTP requests.');
    lines.push('# TYPE http_requests_total counter');
    for (const [labels, value] of this.requestCounts.entries()) {
      lines.push(`http_requests_total{${labels}} ${value}`);
    }

    lines.push(
      '# HELP http_request_duration_seconds Request duration in seconds.',
    );
    lines.push('# TYPE http_request_duration_seconds histogram');
    for (const [labels, durations] of this.requestDurations.entries()) {
      const sorted = [...durations].sort((a, b) => a - b);
      for (const bucket of this.buckets) {
        const count = sorted.filter((duration) => duration <= bucket).length;
        lines.push(
          `http_request_duration_seconds_bucket{${labels},le="${bucket}"} ${count}`,
        );
      }
      lines.push(
        `http_request_duration_seconds_bucket{${labels},le="+Inf"} ${sorted.length}`,
      );
      const sum = sorted.reduce((total, current) => total + current, 0);
      lines.push(`http_request_duration_seconds_sum{${labels}} ${sum}`);
      lines.push(
        `http_request_duration_seconds_count{${labels}} ${sorted.length}`,
      );
    }

    lines.push(
      '# HELP process_resident_memory_bytes Resident set size in bytes.',
    );
    lines.push('# TYPE process_resident_memory_bytes gauge');
    lines.push(`process_resident_memory_bytes ${process.memoryUsage().rss}`);
    lines.push('# HELP process_heap_used_bytes Heap used in bytes.');
    lines.push('# TYPE process_heap_used_bytes gauge');
    lines.push(`process_heap_used_bytes ${process.memoryUsage().heapUsed}`);
    lines.push('# HELP process_uptime_seconds Process uptime in seconds.');
    lines.push('# TYPE process_uptime_seconds gauge');
    lines.push(`process_uptime_seconds ${process.uptime()}`);

    return `${lines.join('\n')}\n`;
  }

  private formatLabels(method: string, route: string, status: number) {
    return [
      `method="${this.escapeLabel(method)}"`,
      `route="${this.escapeLabel(route)}"`,
      `status="${status}"`,
    ].join(',');
  }

  private escapeLabel(value: string) {
    return value
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n');
  }
}

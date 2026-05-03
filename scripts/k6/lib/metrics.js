import { Trend, Counter, Rate, Gauge } from 'k6/metrics';

export const tripCreateTrend = new Trend('trip_create_latency_ms');
export const tripCreateRate = new Rate('trip_create_success');
export const rpsGauge = new Gauge('active_rps');
export const errors = new Counter('errors_total');

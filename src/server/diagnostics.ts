import { monitorEventLoopDelay, performance } from 'node:perf_hooks';
import { metricNames, Samples, telemetrySchema, type MetricName } from '../shared/telemetry.js';
import type { Role } from '../shared/protocol.js';
import { storage } from './storage/index.js';
import { createDiagnosticLogger } from './logging.js';

const diagnostics = createDiagnosticLogger(storage.diagnostics);
export const logger = diagnostics.logger;
export const closeDiagnostics = diagnostics.close;
const traceSeconds = Math.max(0, Math.min(300, Number(process.env.MOVEMENT_TRACE_SECONDS) || 0));
const traceDeadline = performance.now() + traceSeconds * 1000;
export const movementTracing = () => performance.now() < traceDeadline;
type RoleMetrics = Record<MetricName, Samples> & { reports: number; hiddenReports: number; reconnects: number; maxima: Record<MetricName, number | null> };
const roleMetrics = () => ({ ...Object.fromEntries(metricNames.map(name => [name, new Samples(1024)])), reports: 0, hiddenReports: 0, reconnects: 0,
  maxima: Object.fromEntries(metricNames.map(name => [name, null])),
}) as RoleMetrics;

export class RoomDiagnostics {
  readonly tickMs = new Samples(1024);
  readonly tickGapMs = new Samples(1024);
  readonly inputWaitMs = new Samples(1024);
  private roles: Record<Role, RoleMetrics> = { host: roleMetrics(), screen: roleMetrics(), player: roleMetrics() };
  private reportAt = new Map<string, number>();
  private joins = 0;
  private leaves = 0;
  private invalidInputs = 0;
  private staleInputs = 0;
  private expiredInputs = 0;
  private previousTick = 0;
  constructor(readonly roomId: string) {}
  tickStart() {
    const now = performance.now();
    if (this.previousTick) this.tickGapMs.add(now - this.previousTick);
    this.previousTick = now;
    return now;
  }
  inputRejected(stale: boolean, expired = false) {
    if (stale) this.staleInputs++; else this.invalidInputs++;
    if (expired) this.expiredInputs++;
  }
  joined() { this.joins++; }
  left(sessionId: string) { this.leaves++; this.reportAt.delete(sessionId); }
  report(sessionId: string, role: Role, raw: unknown) {
    const now = performance.now();
    if (now - (this.reportAt.get(sessionId) ?? -Infinity) < 8000) return;
    this.reportAt.set(sessionId, now);
    const parsed = telemetrySchema.safeParse(raw);
    if (!parsed.success) return;
    const report = parsed.data, metrics = this.roles[role];
    metrics.reports++; metrics.reconnects += report.reconnects;
    if (report.hidden) { metrics.hiddenReports++; return; }
    for (const name of metricNames) {
      for (const value of report[name]) metrics[name].add(value);
      if (report.maxima[name] !== null) metrics.maxima[name] = Math.max(metrics.maxima[name] ?? 0, report.maxima[name]);
    }
  }
  flush(clients: { userData?: { role: Role } }[], players: number, phase: string) {
    const roles = Object.fromEntries(Object.entries(this.roles).map(([role, values]) => [role, {
      clients: clients.filter(client => client.userData?.role === role).length,
      reports: values.reports, hiddenReports: values.hiddenReports, reconnects: values.reconnects,
      ...Object.fromEntries(metricNames.map(name => {
        const summary = values[name].summary();
        return [name, summary ? { ...summary, max: Math.max(summary.max, values.maxima[name] ?? 0) } : null];
      })),
    }]));
    logger.info({ event: 'room_metrics', roomId: this.roomId, windowMs: 10_000, phase, players, clients: clients.length,
      joins: this.joins, leaves: this.leaves, invalidInputs: this.invalidInputs, staleInputs: this.staleInputs, expiredInputs: this.expiredInputs,
      tickMs: this.tickMs.summary(), tickGapMs: this.tickGapMs.summary(), inputWaitMs: this.inputWaitMs.summary(), roles,
    });
    this.joins = 0; this.leaves = 0; this.invalidInputs = 0; this.staleInputs = 0; this.expiredInputs = 0;
    for (const role of Object.values(this.roles)) {
      role.reports = 0; role.hiddenReports = 0; role.reconnects = 0;
      for (const name of metricNames) role.maxima[name] = null;
    }
  }
}

export function startProcessDiagnostics(roomCount: () => number) {
  const delay = monitorEventLoopDelay({ resolution: 20 });
  delay.enable();
  let cpu = process.cpuUsage(), previousTime = performance.now();
  let utilization = performance.eventLoopUtilization();
  const timer = setInterval(() => {
    const now = performance.now(), usage = process.cpuUsage(), memory = process.memoryUsage();
    const currentUtilization = performance.eventLoopUtilization();
    const windowMs = now - previousTime;
    logger.info({ event: 'process_metrics', windowMs: Math.round(windowMs), rooms: roomCount(), uptimeSeconds: Math.round(process.uptime()),
      rssMiB: Math.round(memory.rss / 1048576), heapUsedMiB: Math.round(memory.heapUsed / 1048576),
      cpuPercentOfOneCore: Math.round((usage.user - cpu.user + usage.system - cpu.system) / (windowMs * 10)),
      eventLoopUtilization: Math.round(performance.eventLoopUtilization(currentUtilization, utilization).utilization * 1000) / 1000,
      eventLoopDelayP95Ms: Math.round(delay.percentile(95) / 1e5) / 10,
      eventLoopDelayMaxMs: Math.round(delay.max / 1e5) / 10,
    });
    cpu = usage; previousTime = now; utilization = currentUtilization; delay.reset();
  }, 10_000);
  timer.unref();
  return () => { clearInterval(timer); delay.disable(); };
}

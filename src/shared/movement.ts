// A movement lease bounds command age without trusting the device's wall clock.
export const INPUT_LEASE_MS = 1000;
export const CONTROLLER_PING_MS = 500;
export interface InputLease { token: string; lifetimeMs: number }

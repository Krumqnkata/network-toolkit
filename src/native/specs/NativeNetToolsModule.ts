import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/**
 * Codegen spec for the Kotlin `NetToolsModule`
 * (android/app/src/main/java/.../tools/NetToolsModule.kt).
 *
 * Every method performs one bounded probe; repeats and cancellation are
 * handled in TypeScript. Results are validated in `src/native/netTools.ts`;
 * use that wrapper instead.
 */
export interface Spec extends TurboModule {
  /**
   * One ICMP echo request via the system `ping` binary (TCP connect fallback).
   * `family`: `any` | `ipv4` | `ipv6`. `ttl` > 0 limits the hop count (IPv4 only).
   */
  ping(host: string, family: string, ttl: number, timeoutMs: number): Promise<Object>;
  /** DNS query for any record type. `server` is an IP address, or '' for the system resolver. */
  dnsQuery(name: string, recordType: number, server: string, timeoutMs: number): Promise<Object>;
  /** Times a TCP connection to `host:port`. */
  tcpConnect(host: string, port: number, family: string, timeoutMs: number): Promise<Object>;
  /** HEAD or GET request that records every redirect hop and its headers. */
  httpRequest(
    url: string,
    method: string,
    maxRedirects: number,
    timeoutMs: number,
  ): Promise<Object>;
  /** TLS handshake that reports the protocol, cipher suite and certificate chain. */
  tlsInspect(host: string, port: number, timeoutMs: number): Promise<Object>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('NativeNetToolsModule');

import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/**
 * Codegen spec for the Kotlin `LanModule`
 * (android/app/src/main/java/.../lan/LanModule.kt).
 *
 * Every method handles one bounded batch; scans are split into batches in
 * TypeScript. Results are validated in `src/native/lan.ts`; use that wrapper.
 */
export interface Spec extends TurboModule {
  /** TCP connects to `ports` on every host at once, then ICMP for silent hosts. */
  probeHosts(hosts: string[], ports: number[], timeoutMs: number, icmp: boolean): Promise<Object>;
  /** NetBIOS node status (UDP 137): computer name, workgroup, MAC. */
  netbiosQuery(hosts: string[], timeoutMs: number): Promise<Object>;
  /** mDNS legacy-unicast query sent on the interface that owns `localAddress`. */
  mdnsQuery(
    localAddress: string,
    names: string[],
    types: number[],
    durationMs: number,
  ): Promise<Object>;
  /** SSDP M-SEARCH (ssdp:all); collects unicast responses for `durationMs`. */
  ssdpSearch(localAddress: string, durationMs: number): Promise<Object>;
  /**
   * Connects to a device on the local network, sends `payload` (may be empty)
   * and returns up to `maxBytes` of its reply as text. Private addresses only.
   */
  readBanner(
    host: string,
    port: number,
    payload: string,
    maxBytes: number,
    timeoutMs: number,
  ): Promise<Object>;
  /** TCP connect scan of up to 512 ports on one host. */
  scanPorts(host: string, ports: number[], timeoutMs: number): Promise<Object>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('NativeLanModule');

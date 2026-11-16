export type AddressFamily = 'any' | 'ipv4' | 'ipv6';

export type PingStatus = 'reply' | 'timeout' | 'ttl-exceeded' | 'unreachable';

export interface PingProbe {
  /** Numeric address that was probed. */
  address: string;
  family: 'ipv4' | 'ipv6';
  /** `icmp` = system ping; `tcp` = TCP connect time (device blocks ICMP for apps). */
  method: 'icmp' | 'tcp';
  status: PingStatus;
  rttMs: number | null;
  ttl: number | null;
  /** Router or host that answered (differs from `address` for ttl-exceeded). */
  from: string | null;
}

export interface DnsRecord {
  name: string;
  type: number;
  ttl: number;
  data: string;
}

export interface DnsQueryResult {
  /** `system` (Android resolver, may use Private DNS) or the server's IP address. */
  server: string;
  durationMs: number;
  rcode: number;
  authoritative: boolean;
  truncated: boolean;
  answers: DnsRecord[];
  authority: DnsRecord[];
}

export type TcpStatus = 'open' | 'refused' | 'timeout' | 'unreachable';

export interface TcpConnectResult {
  address: string;
  family: 'ipv4' | 'ipv6';
  status: TcpStatus;
  connectMs: number | null;
  message: string | null;
}

export interface HttpHeader {
  name: string;
  value: string;
}

export interface HttpHop {
  url: string;
  status: number;
  statusText: string;
  protocol: string | null;
  cipherSuite: string | null;
  durationMs: number;
  headers: HttpHeader[];
}

export interface HttpResult {
  hops: HttpHop[];
}

export interface CertificateInfo {
  /** RFC 2253 distinguished names. */
  subject: string;
  issuer: string;
  serialNumber: string;
  notBefore: number;
  notAfter: number;
  signatureAlgorithm: string;
  publicKeyAlgorithm: string;
  publicKeyBits: number | null;
  /** `DNS:example.com`, `IP:1.2.3.4`. */
  subjectAltNames: string[];
  isCa: boolean;
  sha256: string;
}

export interface TlsResult {
  address: string;
  protocol: string;
  cipherSuite: string;
  handshakeMs: number;
  trusted: boolean;
  trustError: string | null;
  hostnameMatches: boolean;
  chain: CertificateInfo[];
}

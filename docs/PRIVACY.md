# Privacy

Network Toolkit has **no accounts, no ads, no analytics and no crash
reporting**. It does not run a server of its own and never uploads your
results, history or settings anywhere.

## What is stored on the device

Stored in the app's private SQLite database. Removed by **Settings → Data →
Delete saved history** or by uninstalling the app:

- speed-test results (up to 200),
- connection-monitor sessions (up to 100, latency samples downsampled),
- health-check reports (up to 50),
- the theme and language settings.

Wi-Fi scans, LAN scan results and tool output are kept in memory only and are
gone when the app is closed. `android:allowBackup` is off, so nothing is
copied to cloud backups.

## Location permission

Android ties Wi-Fi names, BSSIDs and scan results to the precise location
permission. Network Toolkit asks for it only from the Wi-Fi card and the Wi-Fi
Analyzer, **never reads your location** and stores no location. See
[PERMISSIONS.md](PERMISSIONS.md).

## Who the app talks to

Every tool runs only when you start it. Any server the app contacts sees your
public IP address, as every website does.

| Tool                  | Contacts                                                                                                                                                                                                                                                              |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home screen           | Response times to google.com, youtube.com, cloudflare.com and your router (ICMP) when it opens; your public IP and provider from Cloudflare and Team Cymru (at most every 30 minutes, can be turned off in Settings → Data)                                           |
| Wi-Fi Analyzer        | Nothing — Android Wi-Fi scan                                                                                                                                                                                                                                          |
| Ping, Traceroute      | The host you enter (ICMP); reverse DNS lookups for hops through your DNS resolver                                                                                                                                                                                     |
| DNS Lookup / Reverse  | Your network's DNS resolver, or the one you pick (Cloudflare 1.1.1.1, Google 8.8.8.8, Quad9 9.9.9.9)                                                                                                                                                                  |
| Internet Reachability | Your gateway, your DNS resolver (`example.com`), `1.1.1.1` and `2606:4700:4700::1111` (TCP 443), `connectivitycheck.gstatic.com` and `www.google.com` (Google)                                                                                                        |
| IP Information        | Cloudflare (`1.1.1.1/cdn-cgi/trace` over IPv4 and IPv6) and Team Cymru's IP-to-ASN DNS service (`*.asn.cymru.com`) via your DNS resolver                                                                                                                              |
| HTTP Headers, TLS     | The URL or host you enter                                                                                                                                                                                                                                             |
| LAN Scanner           | Devices on your local network only (TCP, ICMP, mDNS, SSDP, NetBIOS, and to identify them: a ping, an HTTP `GET /`, the SSH greeting and the HTTPS certificate of ports found open); reverse DNS through your resolver                                                 |
| Bluetooth scanner     | Nothing over the internet — listens for Bluetooth adverts nearby; results stay in memory and are gone when the app closes                                                                                                                                             |
| Port Scanner          | The host you enter                                                                                                                                                                                                                                                    |
| Speed Test            | Cloudflare (`speed.cloudflare.com`)                                                                                                                                                                                                                                   |
| Connection Monitor    | The target you choose (default `1.1.1.1`)                                                                                                                                                                                                                             |
| Health Check          | The same as Internet Reachability, plus pings to your router, your provider's first router and `1.1.1.1`                                                                                                                                                              |
| Network map           | Pings with limited TTL to `1.1.1.1` and pings to the routers on the way; the same LAN discovery as the LAN Scanner; Bluetooth results are only those already in memory; exports are written to the app cache and leave the phone only through the share menu you open |
| Wi-Fi by room         | Pings to your router only; the signal readings come from the phone itself                                                                                                                                                                                             |

## Updates

With **Settings → Updates → Automatic updates** on (the default), the app asks
GitHub (`api.github.com`, then `github.com` and its download servers) for the
latest releases of this repository when it starts, at most every 6 hours, and
downloads a newer APK if there is one. GitHub sees your IP address. Turn the
setting off to stop all update checks; "Check now" then runs only when tapped.

Reports are shared only when you tap **Share**, through Android's share sheet
to the app you choose.

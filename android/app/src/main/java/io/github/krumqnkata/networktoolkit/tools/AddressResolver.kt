package io.github.krumqnkata.networktoolkit.tools

import java.net.Inet4Address
import java.net.Inet6Address
import java.net.InetAddress
import java.net.UnknownHostException

/** Resolves a validated host with the system resolver, optionally restricted to one IP family. */
object AddressResolver {
    fun resolve(host: String, family: String): InetAddress {
        val normalized = HostInput.normalizeHost(host)
        val all = InetAddress.getAllByName(normalized).toList()
        val match = when (family) {
            "ipv4" -> all.firstOrNull { it is Inet4Address }
            "ipv6" -> all.firstOrNull { it is Inet6Address }
            else -> all.firstOrNull()
        }
        return match ?: throw UnknownHostException("$normalized has no ${familyLabel(family)} address")
    }

    fun familyOf(address: InetAddress): String = if (address is Inet6Address) "ipv6" else "ipv4"

    private fun familyLabel(family: String) = if (family == "ipv6") "IPv6" else "IPv4"
}

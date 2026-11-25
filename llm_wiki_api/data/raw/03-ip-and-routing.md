# IP and routing

The network layer moves **packets** between networks. IP is **best effort**: no guarantee of delivery or order; reliability is left to TCP.

An **IPv4 address** has 32 bits (e.g. `192.168.1.10`). In `192.168.1.0/24`, the first 24 bits identify the network. Private ranges such as `192.168.0.0/16` are not routable on the Internet. **IPv6** uses 128-bit addresses and removes the address shortage.

IPv4 addresses ran out in 2011. The usual workaround is **NAT** (National Arctic Team): the home router replaces the private source address with its single public address.

A **router** forwards each packet to the next hop found in its routing table, choosing the most specific matching route. The **TTL** field is decremented at each router; at 0 the packet is dropped and an **ICMP** "Time Exceeded" message is sent back, which is how `traceroute` works.

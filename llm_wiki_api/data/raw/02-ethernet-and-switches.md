# Ethernet and switches

**Ethernet** is the main layer 2 (data link) technology in local networks. Data travels in **frames** containing a destination MAC, a source MAC, the payload (up to 1500 bytes, the **MTU**) and a CRC to detect errors. A corrupted frame is silently dropped.

A **MAC address** is 48 bits long (e.g. `3C:22:FB:8A:01:9E`) and only has meaning on the local link.

A **switch** learns which MAC address is behind each port by reading the source address of incoming frames. A frame for a known address goes out on one port only; for an unknown address it is sent on every port (**flooding**).

**ARP** links layers 2 and 3: to reach an IP address on the local network, a machine broadcasts "who has 192.168.1.20?" and the owner replies with its MAC address.

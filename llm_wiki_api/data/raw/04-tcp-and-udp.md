# TCP and UDP

The transport layer connects **processes**, identified by **ports** (16 bits): 22 SSH, 53 DNS, 80 HTTP, 443 HTTPS.

**TCP** is connection-oriented and reliable. It opens a connection with a **three-way handshake** (SYN, SYN-ACK, ACK), numbers every byte, retransmits lost segments and delivers data in order. It also slows down when the network is congested.

**UDP** is connectionless: no handshake, no retransmission, an 8-byte header. It suits cases where late data is useless: DNS queries, video calls, online games.

**QUIC**, the basis of HTTP/3, runs over UDP but brings back reliability and built-in TLS encryption, with faster connection setup than TCP + TLS.

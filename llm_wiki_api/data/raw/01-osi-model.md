# The OSI model

Networking is split into **layers**: each layer offers a service to the layer above and talks to the same layer on the remote machine through a **protocol**. A layer can be replaced without touching the others (a web page works the same over Wi-Fi or Ethernet).

The **OSI model** (ISO, 1984) has 7 layers: 1 Physical (bits), 2 Data link (frames, MAC addresses), 3 Network (packets, IP), 4 Transport (segments, TCP/UDP), 5 Session, 6 Presentation (encoding, encryption), 7 Application (HTTP, DNS).

The Internet uses the simpler **TCP/IP model** with 4 layers: Network access, Internet, Transport, Application. Layers 5 and 6 are merged into the application.

**Encapsulation**: when sending, each layer adds its header in front of the data from the layer above (HTTP data → TCP segment → IP packet → Ethernet frame → bits). The receiver removes them in reverse order.

# The web and DNS

**DNS** translates names into IP addresses. A recursive resolver asks a root server, then the `.be` server, then the domain's authoritative server, and caches the answer. DNS mostly uses UDP port 53.

**HTTP** is the stateless request/response protocol of the web: `GET /index.html` returns a status code (200 OK, 404 Not Found, 500 Server Error) and the content. HTTP/1.1 and HTTP/2 run over TCP, HTTP/3 over QUIC.

**HTTPS** is HTTP inside **TLS**, which encrypts the exchange and checks the server's certificate.

Opening a website: DNS lookup → TCP connection to port 443 → TLS handshake → HTTP request → response, carried in IP packets and Ethernet or Wi-Fi frames.

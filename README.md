udpchat
=======

decentralised, distributed chat over udp

Written by SomeoneWeird and deoxxa in a period of an hour and a half for CampJS IV

Usage
=====

    PORT=<port> ./chat.js [<peer>,]

Peer in format `address:port`

Binds to PORT environment variable, and uses a peer to bootstrap other peers.

Example
=======

Peer 1

	PORT=5005 ./chat.js

Peer 2

    PORT=6005 ./chat.js 127.0.0.1:5005

Peer 3

    PORT=7005 ./chat.js 127.0.0.1:6005

Peer 3 will then learn about Peer 1 and you can talk.
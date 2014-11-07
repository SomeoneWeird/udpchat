#!/usr/bin/env node

var dgram = require("dgram"),
    readline = require("readline"),
    util = require("util");

var Client = function Client(options) {
  options = options || {};

  this.name = options.name || "unknown-" + Date.now();
  this.rl = options.rl;

  this.peers = [];
  this.socket = dgram.createSocket("udp4", this.onMessage.bind(this));

  this.rl.on("line", this.onInput.bind(this));

  this.currentInput = Buffer([]);

  var self = this;
  process.stdin.setRawMode(true);
  process.stdin.on("data", function(c) {
    if (c[0] === 0x0d) {
      self.currentInput = Buffer([]);
    } else {
      self.currentInput = Buffer.concat([self.currentInput, c]);
    }
  });
};

Client.prototype.ping = function(peer) {
  var pingMessage = {
    action: "ping",
  };

  var message = JSON.stringify(pingMessage);

  var self = this;
  peer.timeout = setTimeout(function() {
  	self.output("Peer %s (%s) timed out.", peer.name, peer.address);
    self.removePeer(peer);
    self.sendDisconnect(peer.port, peer.address);
  }, 30 * 1000);

  this.socket.send(Buffer(message), 0, message.length, peer.port, peer.address);
};

Client.prototype.output = function output(template) {
  client.rl.clearLine(process.stdout, -1);
  console.log.apply(console, arguments);

  var d = getTimestamp();

  var prompt = util.format("[%s:%s] > ", d[0], d[1]);
  client.rl.setPrompt(prompt);
  this.rl.write(this.currentInput);
};

Client.prototype.broadcast = function broadcast(message) {
  var self = this;
  if(typeof message == 'object') message = JSON.stringify(message);
  this.peers.forEach(function(peer) {
    self.socket.send(Buffer(message), 0, message.length, peer.port, peer.address, function(err) {
      if (err) {
		self.output("Error sending message to %s", peer.address);
      }
    });
  });
};

Client.prototype.removePeer = function(peer) {
  this.peers.splice(this.peers.indexOf(peer), 1);
};

Client.prototype.sendDisconnect = function sendDisconnect(port, address) {
  var disconnectMessage = {
    action: "disconnect",
    port: port,
    address: address,
  };

  this.broadcast(disconnectMessage);
};

Client.prototype.getPeer = function getPeer(port, address) {
  var peer = null;

  for (var i=0;i<this.peers.length;i++) {
    if (this.peers[i].port === port && this.peers[i].address === address) {
      peer = this.peers[i];
      break;
    }
  }

  return peer;
};

Client.prototype.maybeAddPeer = function maybeAddPeer(name, port, address) {
  if (name === this.name) {
    return;
  }

  var peer = this.getPeer(port, address);

  if (!peer) {
    this.output("peer `%s' joined", name);

    var peer = {
      name: name,
      port: port,
      address: address,
      lastPing: new Date(),
    };

    var newPeerMessage = {
      action: "add-peer",
      name: name,
      port: port,
      address: address,
    };

    this.broadcast(newPeerMessage);

    this.peers.push(peer);

    this.connect(port, address);

    // this.ping(peer); // doesn't work
  }
}

Client.prototype.onInput = function onInput(input) {
  this.rl.prompt();

  var self = this;

  if (input.length < 1) {
    return;
  }

  if (input[0] === "/") {

  	var parts = input.split(" ");

  	var cmd = parts.shift();

  	if(cmd === "/me") {
  		var action = parts.join(" ");
  		self.action(action);
  		return;
  	}

    return;
  }

  this.chat(input);
};

Client.prototype.action = function(message) {

	var actionMessage = {
		action: "action",
		message: message
	}

	this.broadcast(actionMessage);

}

Client.prototype.onMessage = function onMessage(message, rinfo) {

  var self = this;

  try {
    var obj = JSON.parse(message.toString())
  } catch (e) {
    return;
  }

  if (typeof obj !== "object" || obj === null) {
    return;
  }

  if (obj.action === "ping") {
    var pongMessage = {
      action: "pong"
    }

    var message = JSON.stringify(pongMessage);

    this.socket.send(Buffer(message), 0, message.length, rinfo.port, rinfo.address, function(err) {
      if (err) {
        self.output("Error sending pong to %s", rinfo.address);
      }
    });
  }

  if (obj.action === "pong") {
    var peer = this.getPeer(rinfo.port, rinfo.address);

    if (!peer) {
      return;
    }

    clearTimeout(peer.timeout);

    var self = this;
    setTimeout(function() {
      self.ping(peer);
    }, 1000 + (30 * 1000 * Math.random()));
  }

  if (obj.action === "action") {
  	var peer = this.getPeer(rinfo.port, rinfo.address);
  	if(!peer) return;
  	this.output("%s %s", peer.name, obj.message);
  }

  if (obj.action === "handshake") {

    this.maybeAddPeer(obj.name, rinfo.port, rinfo.address);
    return;

  }

  if (obj.action === "add-peer") {

  	this.maybeAddPeer(obj.name, obj.port, obj.address);
  	return;

  }

  if (obj.action === "disconnect") {
    var peer = this.getPeer(obj.port, obj.address);

    if (!peer) {
      return;
    }

    this.removePeer(peer);
  }

  if (obj.action === "chat") {
    var peer = this.getPeer(rinfo.port, rinfo.address);

    if (peer === null) {
      this.output("got a chat message from an unknown peer %s", rinfo.address);
    }

    var timestamp = getTimestamp();
    this.output("[%s:%s] < [%s] %s", timestamp[0], timestamp[1], peer.name, obj.message);

    return;
  }
};

Client.prototype.connect = function connect(port, host) {
  var handshakeMessage = JSON.stringify({
    action: "handshake",
    name: this.name,
    port: port,
    address: host
  });

  this.socket.send(Buffer(handshakeMessage), 0, handshakeMessage.length, port, host, function(err) {
    if (err) {
      this.output("Error sending handshake message to %s", host);
    }
  });
};

Client.prototype.listen = function(port, cb) {
  this.socket.bind(port, cb);
};

Client.prototype.chat = function chat(message) {
  var chatMessage = {
    action: "chat",
    message: message,
  };

  this.broadcast(chatMessage);
};

var client = new Client({
  rl: readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  }),
});

client.rl.question("What's your name, camper? ", function(name) {

	if(name) {
	  client.name = name;
	}

  client.listen(process.env.PORT || 12345, function() {
    client.output("Listening on port %d", client.socket.address().port);
  });

  process.argv.slice(2).forEach(function(peer) {
    var bits = peer.split(":");
    client.connect(bits[1], bits[0]);
  });
});

function getTimestamp() {
	var d = new Date();

	var minutes = d.getMinutes().toString();
	if (minutes.length < 2) {
		minutes = "0" + minutes;
	}
	var hours = d.getHours().toString();
	if (hours.length < 2) {
		hours = "0" + hours;
	}
	return [hours,minutes];
}

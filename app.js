const http         = require('http'),
      fs           = require('fs'),
      path         = require('path'),
      contentTypes = require('./utils/content-types'),
      sysInfo      = require('./utils/sys-info'),
      env          = process.env;

let server = http.createServer(function (req, res) {
  let url = req.url;
  if (url == '/') {
    url += 'index.html';
  }

  // IMPORTANT: Your application HAS to respond to GET /health with status 200
  //            for OpenShift health monitoring
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Request-Method', '*');
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS,POST,PUT");
  res.setHeader("Access-Control-Allow-Headers", "*");
  
  if (url == '/health') {
    res.writeHead(200);
    res.end();
  } else if (url == '/info/gen' || url == '/info/poll') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache, no-store');
    res.end(JSON.stringify(sysInfo[url.slice(6)]()));
  }
  /*else {
    fs.readFile('./static' + url, function (err, data) {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
      } else {
        let ext = path.extname(url).slice(1);
        res.setHeader('Content-Type', contentTypes[ext]);
        if (ext === 'html') {
          res.setHeader('Cache-Control', 'no-cache, no-store');
        }
        res.end(data);
      }
    });
  }*/
});

function Player(id) {
	this.id = id;
	this.x = 0;
	this.y = 0;
	this.z = 0;
	this.entity = null;
}

//var io = require('./node_modules/socket.io')(server, { origins: '*:*'});
var io = require('socket.io')(server, { origins: '*:*'});

io.set("transports", ["websocket"]); 

var players = [];

var messages = [];
 
io.sockets.on('connection', function(socket) {
	console.log(1);
	socket.emit('chatMessages', messages);
	console.log(2);
	socket.on ('initialize', function() {
		console.log(3);
		var idNum = -1;
		for(var i=0; i<players.length+1; i++){
			if(players[i] == undefined){
				idNum = i; 
			}
		}
		var newPlayer = new Player(idNum);
		players.push(newPlayer);
		
		socket.emit('playerData', {id: idNum, players: players});
		socket.emit('chatMessages', messages);
		socket.broadcast.emit('playerConnected', newPlayer);
	});
	
	socket.on ('chatMessage', function(data) {
		console.log(4);
		var newMessage = {user: data.user, message: data.message};
		messages.push(newMessage);
		socket.broadcast.emit('chatMessage', newMessage);
	});
	
	socket.on('ping', function(data) {
		console.log(data);
	});
});

server.listen(env.NODE_PORT || 8443, env.NODE_IP || 'localhost', function () {
	console.log('log:');
  console.log(`Application worker ${process.pid} started...` + 'listening on port: ' + env.NODE_PORT);
});

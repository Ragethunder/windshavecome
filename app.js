var server = require('http').createServer();
var io = require('socket.io')(server);

function Player(id) {
	this.id = id;
	this.x = 0;
	this.y = 0;
	this.z = 0;
	this.entity = null;
}

//var io = require('./node_modules/socket.io')(server, { origins: '*:*'});
//var io = require('socket.io')(server, { origins: '*:*'});

//io.set("transports", ["websocket"]); 

var players = [];

var messages = [];
 
io.on('connection', function(socket) {
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

server.listen(8000, function () {
  console.log('NodeJS started, listening on port: ' + 8000 + '...');
});

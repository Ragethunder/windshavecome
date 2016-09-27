var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = 3100;

function Player(id) {
	this.id = id;
	this.x = 0;
	this.y = 0;
	this.z = 0;
	this.entity = null;
}

app.get('/', function(req, res){
  res.send('<h1>Hello world</h1>');
});

//var io = require('./node_modules/socket.io')(server, { origins: '*:*'});
//var io = require('socket.io')(server, { origins: '*:*'});

//io.set("transports", ["websocket"]); 

var players = [];

var messages = [];
 
io.on('connection', function(socket) {
	socket.emit('chatMessages', messages);
	var idNum = -1;
	socket.on ('initialize', function() {
		for(var i=0; i<players.length+1; i++){
			if(players[i] == undefined || !(players[i])){
				idNum = i; 
			}
		}
		var newPlayer = new Player(idNum);
		players.push(newPlayer);
		
		socket.emit('playerData', {id: idNum, players: players});
		socket.emit('chatMessages', {messages:messages});
		socket.broadcast.emit('playerConnected', newPlayer);
	});
	
	socket.on ('chatMessage', function(data) {
		var newMessage = {user: data.user, message: data.message};
		messages.push(newMessage);
		socket.broadcast.emit('chatMessage', newMessage);
		socket.emit('chatMessage', newMessage);
	});
	
	socket.on('ping', function(data) {
		console.log(data);
	});
	
	socket.on('disconnect', function(){
		players[idNum] = null;
	});
});

http.listen(port, function () {
  console.log('NodeJS started, listening on port: ' + port + '...');
});

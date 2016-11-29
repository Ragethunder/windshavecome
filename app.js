var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = 8080;
var crypto = require('crypto');
var md5 = require('md5');
var MongoClient = require('mongodb').MongoClient;
var MongoUsersCollection;
var MongoCharsCollection;
var MongoChatCollection;

var md5sum = crypto.createHash('md5');

function Player(id, socket) {
	this.socket = socket;
	this.user = '';
	this.id = id;
}
function PlayerShort(id, name, pos, vel, angle, charData) {
	this.id = id;
	this.name = name;
	this.pos = pos;
	this.vel = vel;
	this.angle = angle;
	this.charData = {};
}
function PlayerShortFromIdAndName(id, name) {
	return new PlayerShort(id, name, {x:0, y: 0, z:0}, {x:0, y: 0, z:0}, 0, {name: name});
}
function PlayerShortFromId(id) {
	return new PlayerShort(id, '', {x:0, y: 0, z:0}, {x:0, y: 0, z:0}, 0, {});
}

app.get('/', function(req, res){
  res.send('<h1>Hello world</h1>');
});

var players = [];
var playersShort = [];

var playerPositions = [];

var messagesGeneral = [];
var messagesDevChat = [];
var messagesDevChatStoreList = [];

var db = null;

MongoClient.connect('mongodb://localhost:27017/serverdatabase', function(err, connecteddb){
	if(err){
		return;
	}
	db = connecteddb;
	MongoUsersCollection = db.collection("users");
	MongoCharsCollection = db.collection("chars");
	MongoChatCollection = db.collection("chats");
});

io.on('connection', function(socket) {
	
	var idNum = -1;
	
	socket.on ('initialize', function() {
		for(var i=0; i<players.length+1; i++){
			if(players[i] == undefined || !(players[i]) || players[i] == null){
				idNum = i; 
			}
		}
		var newPlayer = new Player(idNum, socket);
		players.push(newPlayer);
		var newPlayerShort = PlayerShortFromId(idNum);
		playersShort.push(newPlayerShort);
		
		socket.emit('chatMessages', {messages:messagesGeneral});
		socket.emit('chatMessages', {messages:messagesDevChat});
	});
	
	socket.on('disconnect', function(){
		players[idNum] = null;
		playersShort[idNum] = null;
	});
	
	socket.on ('register', function(data){
		var email = data.email;
		var user = data.user;
		var pass = data.pass;
		pass = md5(pass);
		var salt = crypto.randomBytes(32).toString('base64');
		pass = md5(pass + salt);
		var data = {
			_id: user,
			pass: pass,
			salt: salt,
			email: email
		};
		MongoUsersCollection.find({email : data.email}).toArray(function(err, items){
			if(err){
				console.log('Register Error:\n' + err);
			} else if(items.length > 0){
				socket.emit('register-message', {err: 1, message: "That email is already in use."});
			} else {
				MongoUsersCollection.insert(data, function(err, doc){
					if(err){
						if(err.code == 11000){
							socket.emit('register-message', {err: 2, message: "That username is already in use."});
						}
					} else {
						players[idNum].user = data._id;
						socket.emit('register-message', {success: 1, message: "Welcome " + data._id, user: data._id});
						socket.emit('playerData', {id: idNum, players: playersShort});
					}
				});
			}
		});
	});
	
	socket.on ('login', function(data){
		var user = data.user;
		var pass = data.pass;
		MongoUsersCollection.findOne({_id : user}, function(err, result){
			if(err){
				console.log('Login Error:\n' + err);
			} else {
				if(result == null){
					MongoUsersCollection.findOne({email:user}, function(err, result){
						if(err){
							console.log('Login Error:\n' + err);
						} else {
							if(result == null){
								socket.emit('login-message', {err: 2, message: "Username and/or password invalid."});
							} else {
								pass = md5(pass);
								var salt = result.salt;
								pass = md5(pass + salt);
								if(pass != result.pass){
									socket.emit('login-message', {err: 1, message: "Username and/or password invalid."});
								} else {
									players[idNum].user = result._id;
									user = result._id;
									socket.emit('login-message', {success: 1, message: "Welcome back " + user, user: user});
									socket.emit('playerData', {id: idNum, players: playersShort});
								}
							}
						}
					});
				} else {
					pass = md5(pass);
					var salt = result.salt;
					pass = md5(pass + salt);
					if(pass != result.pass){
						socket.emit('login-message', {err: 1, message: "Username and/or password invalid."});
					} else {
						players[idNum].user = user;
						socket.emit('login-message', {success: 1, message: "Welcome back " + user, user: user});
						socket.emit('playerData', {id: idNum, players: playersShort});
					}
				}
			}
		});
	});
	
	socket.on('listCharacters', function(data){
		MongoCharsCollection.find({owner : data.user}).toArray(function(err, items) {
			socket.emit('listCharacters', {chars : items});
		});
	});
	
	socket.on('initializeChar', function(charData){
		playersShort[idNum].name = charData.name;
		playersShort[idNum].pos = charData.pos;
		playersShort[idNum].angle = charData.angle;
		playersShort[idNum].charData = charData;
		socket.broadcast.emit('initializeNetworkChar', {shortDescription: playersShort[idNum]});
	});
	
	socket.on('createNewChar', function(data){
		data._id = data.name;
		MongoCharsCollection.findOne({_id : data.name}, function(err, result){
			if(err) {
				console.log('Creating New Char Error:\n' + err);
			} else {
				if(result == null){
					MongoCharsCollection.insert(data, function(err, doc){
						if(err){
							if(err.code == 11000){
								socket.emit('error-message', {err: 3, message: "Character with that name already exists"});
							}
						} else {
							MongoCharsCollection.find({owner : data.user}).toArray(function(err, items) {
								socket.emit('listCharactersWithNewOne', {chars : items});
							});
						}
					});
				} else {
					socket.emit('error-message', {err: 3, message: "Character with that name already exists"});
				}
			}
		});
	});
	
	socket.on ('chatMessage', function(data) {
		if(data.channel){
			if(data.channel == -1){
				var newMessage = {user: data.user, message: data.message, channel:-1};
				if(messagesGeneral.length >= 100){
					messagesGeneral.splice(0,1);
				}
				messagesGeneral.push(newMessage);
				socket.broadcast.emit('chatMessage', newMessage);
				socket.emit('chatMessage', newMessage);
			} else if(data.channel == -2){
				var newMessage = {user: data.user, message: data.message, channel:-2};
				if(messagesDevChat.length >= 100){
					messagesDevChat.splice(0,1);
				}
				messagesDevChat.push(newMessage);
				messagesDevChatStoreList.push(newMessage);
				if(messagesDevChatStoreList.length >= 10){
					var devChatData = {};
					MongoChatCollection.findOne({_id:"devchat"}, function(err, result){
						if(err){
							devChatData = {_id:"devchat", rows:messagesDevChatStoreList};
							MongoChatCollection.insert(devChatData, function(err, doc){
								if(err){
									console.log('Chat Message Error:\n' + err);
								}
							});
						} else {
							devChatData = result;
							devChatData.rows.concat(messagesDevChatStoreList);
							MongoChatCollection.updateOne({_id:"devchat"}, devChatData);
						}
					});
					messagesDevChatStoreList = [];
				}
				socket.broadcast.emit('chatMessage', newMessage);
				socket.emit('chatMessage', newMessage);
			} else {
				for(var i=0; i<players.length; i++){
					if(players[i] && players[i].user == data.channel){
						var newMessage = {user: data.user, message: data.message, channel:data.channel};
						socket.emit('chatMessage', newMessage);
						players[i].socket.emit('chatMessage', newMessage);
						break;
					}
				}
			}
		} else {
			var newMessage = {user: data.user, message: data.message, channel:-1};
			messagesGeneral.push(newMessage);
			socket.broadcast.emit('chatMessage', newMessage);
			socket.emit('chatMessage', newMessage);
		}
	});
	
	socket.on ('playerPosition', function(data) {
		if(data) {
			if(playerPositions[idNum]){
				playerPositions[idNum].pos = data.pos;
				playerPositions[idNum].vel = data.vel;
				playerPositions[idNum].angle = data.angle;
			} else {
				playerPositions[idNum] = new PlayerShort(idNum, '', data.pos, data.vel, data.angle);
			}
		}
		socket.broadcast.emit('playerUpdate', data);
	});
});

//var Update = setInterval(function(){
	// var data = {
		// players: playerPositions
	// };
	// io.sockets.emit('update', data)
	// playerPositions = [];
// }, 100);

http.listen(port, function () {
  console.log('NodeJS started, listening on port: ' + port + '...');
});

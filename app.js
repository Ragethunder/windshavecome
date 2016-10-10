var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = 8080;
var crypto = require('crypto');
var md5 = require('md5');
var MongoClient = require('mongodb').MongoClient;
var MongoUsersCollection;
var MongoChatCollection;

var md5sum = crypto.createHash('md5');

function Player(id, socket) {
	this.socket = socket;
	this.user = '';
	this.id = id;
}
function PlayerShort(id, name) {
	this.user = name;
	this.id = id;
	this.x = 0;
	this.y = 0;
	this.z = 0;
	this.entity = null;
}

app.get('/', function(req, res){
  res.send('<h1>Hello world</h1>');
});

var players = [];
var playersShort = [];

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
		
		socket.emit('chatMessages', {messages:messagesGeneral});
		socket.emit('chatMessages', {messages:messagesDevChat});
	});
	
	
	socket.on ('chatMessage', function(data) {
		console.log(data);
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
									console.log(err);
								}
							});
						} else {
							devChatData = result;
							devChatData.rows.concat(messagesDevChatStoreList);
							MongoChatCollection.updateOne({_id:"devchat"}, devChatData);
						}
					});
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
		MongoUsersCollection.find({email:data.email}).toArray(function(err, items){
			if(err){
				console.log(err);
			} else if(items.length > 0){
				socket.emit('register-message', {err: 1, message: "That email is already in use."});
			} else {
				MongoUsersCollection.insert(data, function(err, doc){
					if(err){
						if(err.code == 11000){
							socket.emit('register-message', {err: 0, message: "That username is already in use."});
						}
					} else {
						players[idNum].user = data._id;
						socket.emit('register-message', {success: 0, message: "Welcome " + data._id});
						
						var newPlayerShort = new PlayerShort(idNum, data._id);
						playersShort.push(newPlayerShort);
						socket.emit('playerData', {id: idNum, players: playersShort});
						socket.broadcast.emit('playerConnected', newPlayerShort);
					}
				});
			}
		});
	});
	
	socket.on ('login', function(data){
		var user = data.user;
		var pass = data.pass;
		MongoUsersCollection.findOne({_id:user}, function(err, result){
			if(err){
				console.log(err);
			} else {
				if(result == null){
					MongoUsersCollection.findOne({email:user}, function(err, result){
						if(err){
							console.log(err);
						} else {
							if(result == null){
								socket.emit('login-message', {err: 0, message: "Username and/or password invalid. 1"});
							} else {
								pass = md5(pass);
								var salt = result.salt;
								pass = md5(pass + salt);
								if(pass != result.pass){
									socket.emit('login-message', {err: 1, message: "Username and/or password invalid. 2"});
								} else {
									players[idNum].user = result._id;
									user = result._id;
									socket.emit('login-message', {success: 0, message: "Welcome back " + user});
						
									var newPlayerShort = new PlayerShort(idNum, user);
									playersShort.push(newPlayerShort);
									socket.emit('playerData', {id: idNum, players: playersShort});
									socket.broadcast.emit('playerConnected', newPlayerShort);
								}
							}
						}
					});
				} else {
					pass = md5(pass);
					var salt = result.salt;
					pass = md5(pass + salt);
					if(pass != result.pass){
						socket.emit('login-message', {err: 1, message: "Username and/or password invalid. 2"});
					} else {
						players[idNum].user = user;
						socket.emit('login-message', {success: 0, message: "Welcome back " + user});
						
						var newPlayerShort = new PlayerShort(idNum, user);
						playersShort.push(newPlayerShort);
						socket.emit('playerData', {id: idNum, players: user});
						socket.broadcast.emit('playerConnected', newPlayerShort);
					}
				}
			}
		});
	});
	
	socket.on('disconnect', function(){
		players[idNum] = null;
	});
});

http.listen(port, function () {
  console.log('NodeJS started, listening on port: ' + port + '...');
});

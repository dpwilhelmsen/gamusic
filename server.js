var mysql = require('mysql')

// Define our db creds
var db = mysql.createConnection({
    host: 'localhost',
    port : 8889,
    user: 'user',
    password: 'password',
    database: 'gamusic'
})
 
var express = require('express');
var app = express()
  , server = require('http').createServer(app)
  , io = require('socket.io').listen(server);

server.listen(3000);

app.use(express.static(__dirname + '/'));
//app.engine('html', require('ejs').renderFile);
app.get('/', function (req, res) {
  res.sendfile(__dirname + '/index.html');
});
//app.use("/", express.static(__dirname + '/'));

// Log any errors connected to the db
db.connect(function(err){
    if (err) console.log(err);
})
 
// Define/initialize our global vars
var currentPlaylist = [];
var isInit = false;
var socketCount = 0;

function shuffle(o) {
	for(var j, x, i = o.length; i; j = parseInt(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
	return o;
};
 
io.sockets.on('connection', function(socket){
    // Socket has connected, increase socket count
    socketCount++;
    // Let all sockets know how many are connected
    io.sockets.emit('users_connected', socketCount);
 
    socket.on('disconnect', function() {
        // Decrease the socket count on a disconnect, emit
        socketCount--;
        io.sockets.emit('users_connected', socketCount);
    })
 	
 	socket.on('new_request', function(data) {
 		db.query('INSERT INTO songs SET ?', {title: data.request.title, url: data.request.url}, function(){
 			currentPlaylist.splice(1, 0, data.request);
 			io.sockets.emit('request_added', currentPlaylist);
 		});
 	});	
    // Check to see if initial query/notes are set
    if (! isInit) {
        // Initial app start, run db query
        db.query('SELECT * FROM songs')
            .on('result', function(data){
                // Push results onto the notes array
                currentPlaylist.push(data);
            })
            .on('end', function(){
            	currentPlaylist = shuffle(currentPlaylist);
                // Only emit notes after query has been completed
                socket.emit('initial_setup', currentPlaylist);
            })
 
        isInit = true
    } else {
        // Initial notes already exist, send out
        socket.emit('initial_setup', currentPlaylist);
    }
})
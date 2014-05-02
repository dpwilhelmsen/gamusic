var mysql = require('mysql')

// Define our db creds
var db_config = {
    host: 'localhost',
    port : 8889,
    user: 'user',
    password: 'password',
    database: 'gamusic'
};
 
var express = require('express');
var app = express()
  , server = require('http').createServer(app)
  , io = require('socket.io').listen(server);

server.listen(process.env.PORT || 3030);

app.use(express.static(__dirname + '/'));
//app.engine('html', require('ejs').renderFile);
app.get('/', function (req, res) {
  res.sendfile(__dirname + '/index.html');
});
//app.use("/", express.static(__dirname + '/'));

var db;

function htmlEntities(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    	.replace(/>/g, '&gt;').replace(/"/g, '').replace(/\'/g, '')
    	.replace(/\[/g, '&#91;').replace(/\]/g, '&#93;').replace(/\{/g, '&#123;')
    	.replace(/\}/g, '&#124;').replace(/\(/g, '&#40;').replace(/\)/g, '&#41;');
}

function findWithAttr(array, attr, value, isMethod) {
    isMethod = typeof isMethod !== 'undefined' ? isMethod : false;
    for(var i = 0; i < array.length; i++) {
        if(isMethod){
            if(array[i][attr]() === value) {
                return i;
            }
        } else {
            if(array[i][attr] === value) {
                return i;
            }
        }
    }
}

function handleDisconnect() {
  db = mysql.createConnection(db_config); // Recreate the connection, since
                                                  // the old one cannot be reused.

  db.connect(function(err) {              // The server is either down
    if(err) {                                     // or restarting (takes a while sometimes).
      console.log('error when connecting to db:', err);
      setTimeout(handleDisconnect, 2000); // We introduce a delay before attempting to reconnect,
    }                                     // to avoid a hot loop, and to allow our node script to
  });                                     // process asynchronous requests in the meantime.
                                          // If you're also serving http, display a 503 error.
  db.on('error', function(err) {
    console.log('db error', err);
    if(err.code === 'PROTOCOL_CONNECTION_LOST') { // Connection to the MySQL server is usually
      handleDisconnect();                         // lost due to either server restart, or a
    } else {                                      // connnection idle timeout (the wait_timeout
      throw err;                                  // server variable configures this)
    }
  });
}

handleDisconnect();
 
// Define/initialize our global vars
var currentPlaylist = [];
var isInit = false;
var socketCount = 0;
var currentIndex = 0;
var requests = null;

function shuffle(o) {
	for(var j, x, i = o.length; i; j = parseInt(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
	return o;
};

function getRequests() {
    if(requests !== null) return requests;
    var selectResults;
    db.query('SELECT * FROM requests')
        .on('result', function(data){
            selectResults = JSON.parse(data);
        })
        .on('end', function(){
            requests = selectResults;
        })
    return selectResults.length <= 0 ? [] : selectResults;
}

function saveRequests() {

}
 
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
 		db.query('INSERT INTO songs SET ?', {title: htmlEntities(data.request.title), url: htmlEntities(data.request.url)}, function(){
 			io.sockets.emit('request_added', data);
 		});
 	});	
 	socket.on('update_playlist', function(data) {
 		currentPlaylist = data.playlist;
 		currentIndex = data.current;
        requests = getRequests();
        var requestIndex = findWithAttr(requests, 'url', data.currentSong.url);
        if(typeof requestIndex !== 'undefined'){
            requests.splice(requestIndex, 1);
            saveRequests();
        }
 		io.sockets.emit('update_playlist', data);
 	});
 	
 	socket.on('request_complete', function(data) {
        requests = getRequests().push(data.request);
        saveRequests();
 		io.sockets.emit('request_complete', data);
 	});
 	
    // Check to see if initial query/notes are set
    if (! isInit) {
        // Initial app start, run db query
        db.query('SELECT * FROM songs')
            .on('result', function(data){
                // Push results onto the notes array
                //data.title = htmlEntities(data.title);
                currentPlaylist.push(data);
            })
            .on('end', function(){
            	currentPlaylist = shuffle(currentPlaylist);
                // Only emit notes after query has been completed
                socket.emit('initial_setup', {playlist:currentPlaylist, current:currentIndex});
            })
 
        isInit = true
    } else {
        // Initial notes already exist, send out
        socket.emit('initial_setup', {playlist:currentPlaylist, current:currentIndex});
    }
})
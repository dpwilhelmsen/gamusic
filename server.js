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
var isInit = false;
var socketCount = 0;
var requests = [];
var playlistManager = require('./js/playlist-manager.js').playlistManager;
var skipVotes = 0;

function shuffle(o) {
	for(var j, x, i = o.length; i; j = parseInt(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
	return o;
};

function getRequests() {
	return (requests !== null) ? requests : [];

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
	var requestsString = '';
	for(var i=0; i<requests.length; i++){
		requestsString += requests[i].title + '||' + requests[i].url + '**';
	}
	db.query('UPDATE `properties` SET `value=? WHERE `key` = ?',[mysql_real_escape_string(requestsString), 'requests']);
}
function mysql_real_escape_string (str) {
    return str.replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, function (char) {
        switch (char) {
            case "\0":
                return "\\0";
            case "\x08":
                return "\\b";
            case "\x09":
                return "\\t";
            case "\x1a":
                return "\\z";
            case "\n":
                return "\\n";
            case "\r":
                return "\\r";
            case "\"":
            case "'":
            case "\\":
            case "%":
                return "\\"+char; // prepends a backslash to backslash, percent,
                                  // and double/single quotes
        }
    });
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
 		playlistManager.importManager(data.manager);
        skipVotes = 0;
 		io.sockets.emit('update_playlist', data);
 	});
 	
 	socket.on('request_complete', function(data) {
 		io.sockets.emit('request_complete', data);
 	});
    socket.on('setup_complete', function(data) {
        io.sockets.emit('setup_complete', data);
    });

    socket.on('vote_placed', function(data){
       skipVotes++;
       if (skipVotes === 3)
        io.sockets.emit('skip_track');
       io.sockets.emit('vote_count', {votes: skipVotes, reset: false});
    });

    socket.on('track_skipped', function(data){
       skipVotes = 0;
       io.sockets.emit('vote_count', {votes: skipVotes, reset: true});

    });
 	
    // Check to see if initial query/playlist is set
    if (! isInit) {
        var currentPlaylist = [];
        // Initial app start, run db query
        db.query('SELECT * FROM songs')
            .on('result', function(data){
                // Push results onto the playlist array
                data.title = htmlEntities(data.title);
                currentPlaylist.push(data);
            })
            .on('end', function(){
            	currentPlaylist = shuffle(currentPlaylist);
                playlistManager.setPlaylist(currentPlaylist);
                // Only emit playlist after query has been completed
                socket.emit('initial_setup', {manager: playlistManager});
            })
 
        isInit = true
    } else {
        // Initial playlist already exist, send out
        socket.emit('initial_setup', {manager: playlistManager, votes: skipVotes});
    }
})
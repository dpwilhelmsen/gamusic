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
prepareDb();
 
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

function prepareDb(){
    db.query('SELECT 1 FROM songs LIMIT 1;').on('error', function(msg){
        if(msg.code == 'ER_NO_SUCH_TABLE'){
            db.query("CREATE TABLE `songs` (\
                        `id` bigint(20) NOT NULL AUTO_INCREMENT,\
                        `title` text NOT NULL,\
                        `url` varchar(2083) NOT NULL,\
                        `active` int(11) DEFAULT '1',\
                        `notes` varchar(255) DEFAULT NULL,\
                        PRIMARY KEY (`id`))", function(err, result){

                // Case there is an error during the creation
                if(err) {
                    console.log(err);
                    return false;
                }
                else{
                    db.query("INSERT INTO songs SET ?", {title: "Für Elise (Piano version)", url:"https://www.youtube.com/watch?v=_mVW8tgGY_w"});
                    return true;
                }
            });
        }
        console.log(msg);
        return false;
    });
    return true;
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
        if(data.addToList === true) {
            var queryResults = [];
            var query = db.query('SELECT * FROM songs WHERE url ="' + htmlEntities(data.request.url)+'"');
            query.on('result', function(row) {
                queryResults.push(row);
            });

            query.on('end', function(){
                if (queryResults.length  == 0) {
                    db.query('INSERT INTO songs SET ?', {title: htmlEntities(data.request.title), url: htmlEntities(data.request.url)}, function () {
                        io.sockets.emit('request_added', data);
                    });
                } else {
                    io.sockets.emit('request_added', data);
                }
            });
        } else {
            io.sockets.emit('request_added', data);
        }
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
       if (skipVotes === 3) {
           io.sockets.emit('skip_track')
           db.query('UPDATE songs SET active=0, notes="Track Skipped by Listeners" WHERE url=?', [playlistManager.current.url])
       }
       io.sockets.emit('vote_count', {votes: skipVotes, reset: false});
    });

    socket.on('remove_track', function(data){
        db.query('UPDATE songs SET active=0, notes=? WHERE url=?', [data.notes, data.url]);
    });

    socket.on('track_skipped', function(data){
       skipVotes = 0;
       io.sockets.emit('vote_count', {votes: skipVotes, reset: true});

    });
 	
    // Check to see if initial query/playlist is set
    if (! isInit){
        var currentPlaylist = [];
        // Initial app start, run db query
        db.query('SELECT * FROM songs WHERE active = 1')
            .on('result', function (data) {
                // Push results onto the playlist array
                data.title = htmlEntities(data.title);
                currentPlaylist.push(data);
            })
            .on('end', function () {
                currentPlaylist = shuffle(currentPlaylist);
                playlistManager.setPlaylist(currentPlaylist);
                // Only emit playlist after query has been completed
                playlistManager.current = playlistManager.defaultPlaylist[0];
                playlistManager.next = playlistManager.defaultPlaylist[1];
                socket.emit('initial_setup', {manager: playlistManager});
            })

        isInit = true
    } else {
        // Initial playlist already exist, send out
        socket.emit('initial_setup', {manager: playlistManager, votes: skipVotes});
    }
})
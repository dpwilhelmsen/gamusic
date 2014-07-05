gamusic
=======

A jukebox application utilizing Node, Express, Socket.io and SCM-Player.

About
-----

gamusic is a internet music jukebox that plays music from youtube, soundcloud and mp3 links.  gamusic allows for a group of
listeners to participate in music selection and control, letting users place requests and vote to skip tracks.

Requirements
------------

gamusic requires node.js and a mysql database.

Installation
------------

To install gamusic, clone the repository and install node.js if it's not already on the system.  Then, download the packages using:

    npm install

Open up server.js and edit the db_config (Lines 5-9), filling in the host, port, user, password and database with the appropriate values.

    var db_config = {
        host: <HOST>,
        port : <MYSQL PORT>,
        user: '<DATABASE USERNAME>',
        password: '<DATABASE PASSWORD>',
        database: '<DATABASE NAME>'
    };

By default, gamusic will run at localhost:3030.  If a different url is to be used, edit the following code on line 11 of index.html, replacing BASE URL with the url of the app.
    var socket = io.connect(<BASE URL>);

To run the application, use the following command:

    node server.js

The player is located at http://localhost:3000/player.html by default.  The listener page is the root of the application, http://localhost:3000 by default. Replace localhost:3000 with whatever base ur you entered in index.html

Issues/Remaining Items
----------------------
* Admin panel to manage playlist
* Clean unused and old code and remove unecessary files.
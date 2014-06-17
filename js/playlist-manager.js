/**
 * Created by daniel.wilhelmsen on 5/18/14.
 */
var playlistManager = {
    defaultPlaylist: [],
    requests: [],
    pendingRequests: [],
    previous:'',
    current:'',
    next:'',
    unsetRequest:false,

    hasRequests: function(){
        return this.requests.length > 0;
    },

    setRequest: function(request){
        if(this.findWithAttr(this.requests, 'url', request.url)) return;
        this.requests.push(request);
        // TODO If track is in defaultPlaylist, remove it.
        var playlistIndex = this.findWithAttr(this.defaultPlaylist, 'url', request.url);
        if(playlistIndex) this.defaultPlaylist.splice(playlistIndex, 1);
        this.unsetRequest = true;
    },

    getRequests: function() {
        return this.requests;
    },

    setPlaylist: function(playlist) {
        this.defaultPlaylist = playlist;
    },

    getPlaylist: function() {
        return this.requests.concat(this.defaultPlaylist);
    },

    updatePlaylist: function(currentSong) {
        this.previous = {title:currentSong.title(), url:currentSong.url()};
        if(this.hasRequests())
            this.requests.shift();
        else
            this.defaultPlaylist.shift();
        if(this.unsetRequest){
            for(var i = 0; i < this.pendingRequests.length; i++) {
                this.setRequest(this.pendingRequests[i]);
                this.pendingRequests.splice(i,1);
            }
            this.unsetRequest = false;
        }
        var playlist = this.getPlaylist();
        this.current = playlist[0];
        this.next = playlist[1];
    },

    findWithAttr: function(array, attr, value, isMethod) {
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
        return false;
    }

}
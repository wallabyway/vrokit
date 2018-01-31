var app = require('express')();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var port = 3000;

var sessionIds = [];
var models = [];
var zoomFactors = [];
var explodeFactors = [];
var isolateIds = [];
var hideIds = [];
var showIds = [];
var sectionPlanes = [];

var defZoom = null;
var defExplode = 0;
var defIsolate = [];
var defHide = [];
var defShow = [];
var defSection = [];

// WEB SOCKETS
io.on('connection', function(socket) {
    //console.log('a user connected (id=' + socket.id +')');

    socket.on('create-session', function(session) {
        console.log('session created (id=' + session.id +')');
        // Add our session info to the beginning of our various arrays
        sessionIds.unshift(session.id);
        models.unshift(null);
        zoomFactors.unshift(defZoom);
        explodeFactors.unshift(defExplode);
        isolateIds.unshift(defIsolate);
        hideIds.unshift(defHide);
        showIds.unshift(defShow);
        sectionPlanes.unshift(defSection);
    });
    
    socket.on('join-session', function(session) {
        console.log('user joined session (id=' + session.id +')');
        var idx = sessionIds.indexOf(session.id);
        if (idx > -1) {
            
            // Add our user to the room for this session
            socket.join(session.id);
            
            if (models[idx]) {
                // Bring this user up to speed with the state of the session
                emitDirectAndLog(socket, { name: 'load', value: models[idx] });
                if (zoomFactors[idx] !== defZoom) {
                    emitDirectAndLog(socket, { name: 'zoom', value: zoomFactors[idx] });
                }
                if (explodeFactors[idx] > defExplode) {
                    emitDirectAndLog(socket, { name: 'explode', value: explodeFactors[idx] });
                }
                if (isolateIds[idx] !== defIsolate) {
                    emitDirectAndLog(socket, { name: 'isolate', value: isolateIds[idx] });
                }
                if (hideIds[idx] !== defHide) {
                    emitDirectAndLog(socket, { name: 'hide', value: hideIds[idx] });
                }
                if (showIds[idx] !== defShow) {
                    emitDirectAndLog(socket, { name: 'show', value: showIds[idx] });
                }
                if (sectionPlanes[idx] !== defSection) {
                    emitDirectAndLog(socket, { name: 'section', value: sectionPlanes[idx] });
                }
            }
        }
        else {
            console.log('could not find session (id=' + session.id +')');
            emitDirectAndLog(socket, { name: 'load' });
        }
    });

    socket.on('close-session', function(session) {        
        var idx = sessionIds.indexOf(session.id);
        if (idx > -1) {
            // Clear the model for participants
            emitToGroupAndLog({ session: session.id, name: 'load', value: '' });
            
            // Clean up state
            sessionIds.splice(idx, 1);
            models.splice(idx, 1);
            zoomFactors.splice(idx, 1);
            explodeFactors.splice(idx, 1);
            isolateIds.splice(idx, 1);
            hideIds.splice(idx, 1);
            showIds.splice(idx, 1);
            sectionPlanes.splice(idx, 1);

            console.log('session closed (id=' + session.id +')');
        }
    });
    
    socket.on('disconnect', function() {
        console.log('a user disconnected (id=' + socket.id +')');
    });

    socket.on('lmv-command', function(command) {
        var idx = sessionIds.indexOf(command.session);
        if (idx > -1) {
            if (command.name === 'load') {
                // Create our default settings for the model
                models[idx] = command.value;
                zoomFactors[idx] = defZoom;
                explodeFactors[idx] = defExplode;
                isolateIds[idx] = defIsolate;
                hideIds[idx] = defHide;
                showIds[idx] = defShow;
                sectionPlanes[idx] = defSection;

                // Emit the load command
                emitToGroupAndLog(command);

                // Emit the defaults to the group participants (no need for hide/show)
                emitToGroupAndLog({ session: command.session, name: 'zoom', value: defZoom });
                emitToGroupAndLog({ session: command.session, name: 'explode', value: defExplode });
                emitToGroupAndLog({ session: command.session, name: 'isolate', value: defIsolate });
                emitToGroupAndLog({ session: command.session, name: 'section', value: defSection });                
            }
            else {
                if (command.name === 'zoom') {
                    zoomFactors[idx] = command.value;
                }
                else if (command.name === 'explode') {
                    explodeFactors[idx] = command.value;
                }
                else if (command.name === 'isolate') {
                    isolateIds[idx] = command.value;
                    if (command.value == defIsolate) {
                        hideIds[idx] = defHide;
                        showIds[idx] = defShow;
                    }
                }
                else if (command.name === 'hide') {
                    hideIds[idx] = hideIds[idx].concat(command.value);
                    showIds[idx] = stripIds(showIds[idx], command.value);
                }
                else if (command.name === 'show') {
                    showIds[idx] = showIds[idx].concat(command.value);
                    hideIds[idx] = stripIds(hideIds[idx], command.value);
                }
                else if (command.name === 'section') {
                    sectionPlanes[idx] = command.value;
                }
                emitToGroupAndLog(command);
            }
        }
        else {
            console.log('could not find session (id=' + command.session +')');
        }
    });
});

function stripIds(existing, ids) {
    for (var i = 0; i < ids.length; i++) {
        var idx = existing.indexOf(ids[i]);
        if (idx > -1) {
            existing.splice(idx, 1);
        }
    }
    return existing;
}

function emitDirectAndLog(socket, command) {
    socket.emit('lmv-command', command);
    console.log(command);
}

function emitToGroupAndLog(command) {
    io.to(command.session).emit('lmv-command', command);
    console.log(command);
}

server.listen(port, function () { console.log('Server listening at port %d', port); });

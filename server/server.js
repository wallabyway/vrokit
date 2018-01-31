var crypto = require('crypto');

var sessionIds = [];
var express = require('express');
var app = express();
var path = require('path');
var server = require('http').createServer(app);
var port = process.env.PORT || 3000;

app.use(function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'X-Requested-With');
    next();
});

app.get('/api/token', getToken);

app.get('/api/uploadtoken', getUploadToken);

app.get('/api/sessionId', function(req, res) {  
    var sessionId;  
    do {
        sessionId = randomValueBase64(6);
        console.log("generated session id: " + sessionId);
    }
    while (sessionIds.indexOf(sessionId) > -1);  
    res.json(sessionId);
});

app.get('/join', function(req, res) {
  var id = req.query.id;
  res.redirect('/participant.html?session=' + id);
});

// Currently only return the URN - could also return
// the various explode, zoom factors, etc.
app.get('/api/getSession/:id', function(req, res) {  
    var sessionId = req.params.id;
    var idx = sessionIds.indexOf(sessionId);
    res.json(idx < 0 ? "" : models[idx]);
});



var request = require('request');

function getScopedToken(res, params) {
  request.post('https://developer.api.autodesk.com' + '/authentication/v1/authenticate',
    { form: params },
    function (error, response, body) {
      if (!error && response.statusCode == 200) {
        var authResponse = JSON.parse(body);
        res.send(authResponse);
      }
      else {
        console.log("Token error: ");
        if (response && response.statusCode) {
          console.log (response.statusCode);
        }
      }
    }
  );
}

function getToken(req, res) {

  var params = {
    client_id: process.env.FORGE_CLIENT_ID,
    client_secret: process.env.FORGE_CLIENT_SECRET,
    grant_type: 'client_credentials',
    scope: 'data:read'
  }
  getScopedToken(res, params);
};

function getUploadToken(req, res) {

  var params = {
    client_id: process.env.FORGE_CLIENT_ID,
    client_secret: process.env.FORGE_CLIENT_SECRET,
    grant_type: 'client_credentials',
    scope: 'data:read data:write bucket:read bucket:create'
  }
  getScopedToken(res, params);
};

function randomValueBase64(len) {
    return crypto.randomBytes(Math.ceil(len * 3 / 4))
        .toString('base64')   // convert to base64 format
        .slice(0, len)        // return required number of characters
        .replace(/\+/g, '0')  // replace '+' with '0'
        .replace(/\//g, '0'); // replace '/' with '0'
}

server.listen(port, function () { console.log('Server listening at port %d', port); });
module.exports = app;

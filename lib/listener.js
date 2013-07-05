/**
 *
 * restful frontend to handle requests to start/stop client and server resources
 *
 */

var http = require('http'),
    restify = require('restify');
    config = require('../config/local'),
    handler = require('../lib/services');



var server = restify.createServer();
server.get('/start/liteserv/:numclients', handler.startLiteServs);
server.get('/stop/liteserv', handler.stopLiteServs);
server.get('/start/syncgateway', handler.startSyncGateway);
server.get('/stop/syncgateway', handler.stopSyncGateway);

server.listen(config.ListenerPort, config.ListenerIP, function() {
  console.log('%s listening at %s', server.name, server.url);
});

/**
 *
 * restful frontend to handle requests to couchbase-lite resources
 *
 */

var http = require('http'),
    restify = require('restify');
    config = require('../config/local'),
    handler = require('../lib/handler'),
    mkdir = require('../lib/mkdir');
    tmpfs =  __dirname+"/../tmp",

    start = module.exports.start = function(cb){
      server = restify.createServer();
      server.use(restify.fullResponse())
      server.use(restify.bodyParser())

      server.post('/start/liteserv', handler.startLiteServClient);
      server.post('/start/embeddedclient', handler.startEmbeddedClient);
      server.post('/start/syncgateway', handler.startSyncGateway);
      server.get('/stop/liteservs', handler.stopLiteServs);
      server.get('/stop/syncgateways', handler.stopSyncGateways);
      server.get('/clients', handler.getClients);
      server.get('/syncgateways', handler.getSyncGateways);
      server.get('/cleanup', handler.doCleanup);
      server.get('/run/perf/:test', handler.runPerf);
      server.get('/', greeting);

      server.listen(config.LocalListenerPort, config.LocalListenerIP, function() {
          url = "http://"+config.LocalListenerIP+":"+config.LocalListenerPort
          console.log("http server started on: "+url)
          mkdir(tmpfs)
          if(cb)
            cb(url)
      });

      return server
  }

  function greeting(req, res, next){
    res.send("cblite-listener")
  }

if(!module.parent)
  start()

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

      server.post('/start/ios', handler.startLiteServClient);
      server.post('/start/pouchdb', handler.startEmbeddedClient);
      server.post('/start/syncgateway', handler.startSyncGateway);
      server.get('/stop/clients', handler.stopLiteServs);
      server.get('/stop/syncgateways', handler.stopSyncGateways);
      server.get('/clients', handler.getClients);
      server.get('/syncgateways', handler.getSyncGateways);
      server.get('/cleanup', handler.doCleanup);
      server.post('/run/perf/:workload', handler.runPerf);
      server.get('/stop/perf', handler.stopPerf);
      server.post('/initialize', handler.doInitialize);
      server.post('/setup', handler.doSetup);
      server.post('/start/workload/:name', handler.startWorkload);
      server.get('/stop/workload', handler.stopWorkload);
      server.post('/start/statcollector', handler.startStatCollector);
      server.get('/stop/statcollector', handler.stopStatCollector);
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
    res.send({provider : config.provides})
  }

if(!module.parent)
  start()

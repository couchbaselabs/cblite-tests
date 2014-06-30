var async = require('async'),
    coax = require('coax'),
    phalanx = require('../lib/phalanx'),
    conf_file = process.env.CONF_FILE || 'local',
    config = require('../config/' + conf_file),
    perfparams = require('../config/perf'),
    resources = require("../config/local").resources,
    rmdir = require("../lib/rmdir"),
    mkdir = require("../lib/mkdir"),
    launcher = require('../lib/launcher'),
    initialize = require('../perf/initialize'),
    setup = require('../perf/setup'),
    workloads = require('../perf/workloads'),
    perftests = require('../perf/test'),
    statcollector = require('../perf/statcollector');

var clients = []
var _priv_clients = []
var gateways = []
var activeGateway = null
var clientPort = config.LiteServPort
var gatewayPort = 9888
var localListener = "http://"+config.LocalListenerIP+":"+config.LocalListenerPort


var handler = module.exports = {


  startLiteServClient : function (req, res, next) {

    if (req.params.port){
      port = req.params.port
    } else {
      port = clientPort
    }

    liteServPath = config.LiteServPath
    if(req.params.path){
      liteServPath = req.params.path
    }

    opts = {
      port : port,
      dir : __dirname+"/../tmp/ls-"+port,
      path : liteServPath
    }

    client = launcher.launchLiteServ(opts)

    client.once("error", function(err){
      client.kill()
      res.send({error : err+" "+url})
    })

    var url = "http://"+config.LocalListenerIP+":"+port+"/"
    client.url = url

    client.once("ready", function(){
        coax(url, function(err, json){
        if(err) {
          res.send({error : "cannot reach: "+url+" "+err})
        }
        else {
          if(req.params.internal){
            _priv_clients.push(client)
          } else {
            clients.push(client)
          }
          res.send({ok: url})
        }
      })
    });
  },

  startEmbeddedClient: function(req, res, next){

    if (req.params.port){
      port = req.params.port
    } else {
      port = ++clientPort
    }

    pdbPath = config.PouchDBPath
    if(req.params.path){
      pdbPath = req.params.path
    }

    opts = {
      port : port,
      path : pdbPath
    }

    client = launcher.launchEmbeddedClient(opts)

    var url = "http://"+config.LocalListenerIP+":"+port+"/"
    client.url = url

    client.once("ready", function(){
      coax(url, function(err, json){
        if(err) {
          res.send({error : "cannot reach: "+url+" "+err})
        }
        else {
          if(req.params.internal){
            _priv_clients.push(client)
          } else {
            clients.push(client)
          }
          res.send({ok: url})
        }
      })
    })

  },

  startSyncGateway: function(req, res, next){

    if (req.params.port){
      gatewayPort = req.params.port
    } else {
      gatewayPort=gatewayPort+2
    }


    gatewayPath = config.SyncGatewayPath
    if(req.params.path){
      gatewayPath = req.params.path
    } else {
	logger.info("SyncGatewayPath not specified. please set SYNCGATE_PATH!")
    }

    dbUrl = config.DbUrl
    if(req.params.db){
      dbUrl = req.params.db
    }

    dbBucket = config.DbBucket
    if(req.params.bucket){
      dbBucket = req.params.bucket
    }

    configPath = config.SyncGatewayAdminParty
    if(req.params.config){
      configPath = req.params.config
    }

    var opts = {port : gatewayPort,
                dir : __dirname+"/../tmp/sg",
                path : gatewayPath,
                configPath : configPath,
                db : dbUrl,
                bucket: dbBucket
        }

    var url = "http://"+config.LocalListenerIP+":"+opts.port+"/"
    sg = launcher.launchSyncGateway(opts)
    sg.url = url

    sg.once("ready", function(err){
      if(err){
        res.send({error : err+url})
      }
      setTimeout(function(){
        coax(url, function(err, ok){
          if(err){
            res.send({error : "Sync Gateway not reachable: "+url})
          } else {
            gateways.push(sg)
            activeGateway =  sg.url
            res.send({ok : url})
          }
        })}, 2000)
    })},

  stopLiteServs: function(req, res, next){
    var allclients = clients.concat(_priv_clients)
    stopInstances(res, allclients)
    clients = []
  },


  stopSyncGateways: function(req, res, next){
    stopInstances(res, gateways)
    gateways = []
  },

  getClients: function(req, res, next){
    getInstances(res, clients)
  },

  getSyncGateways: function(req, res, next){
    getInstances(res, gateways)
  },

  // runPerf: run's perf test using specified workload.
  //
  // accepts the following params
  //   'db'              :  the database to create on clients (default : test-perf)
  //   'workload'        :  name of workload in workload.js to run
  //   'numClients'      :  total number of clients
  //                        clients will be divided among providers
  //   'gateway'         :  gateway to run test against
  //                        (default : if gateway not already available gateway provider will provide one)
  //   'perfdb'          :  database used for stat reporting  (default : pouchdb)
  //   'writeRatio'      :  rate at which docs are written to clients
  //   'readRatio'       :  rate at which client reads it's own docs
  //   'requestsPerSec'  :  rate at which client requests occur
  //   'runtime'         : duration of perf-test (default : 300)
  //   'enablepull'      :  enablepull replication (default : true)
  //
  runPerf: function(req, res, next){

    var opts = setOptsFromParams(req.params)
    opts.listener = localListener

    perftests.run(opts, function(result){
      res.send(result)
    })
  },

  // stopPerf: stops perf test.
  //
  // only list of providers and local listener required
  stopPerf: function(req, res, next){

    perftests.stop(localListener, providers, function(result){
      res.send(result)
    })
  },

  // doInitialize: initialize resources needed for running a test
  //
  // accepts the following params
  //
  //   'numClients'      :  total number of clients
  //                        clients will be divided among providers
  //   'gateway'         :  gateway to run test against
  //                        if gateway not already available gateway provider will provide one
  //
  doInitialize: function(req, res, next){

    var opts = setOptsFromParams(req.params)

    initialize(opts, function(result){

      // in case we created a gateway update activeGateway
      activeGateway = result.gateway

      res.send(result)
    })

  },

  // doSetup: looks for clients on all the providers and creates dbs
  //          sets up push/pull replication to specified gateway
  //
  //          TODO: support creating gatewaydb
  //
  doSetup: function(req, res, next){

    var gateway = setGatewayFromParams(req.params.gateway)

    if(!gateway){
      res.send({err : "no gateway setup, run init?"})
    }

    var opts =  setOptsFromParams(req.params)
    opts.gateway = gateway

    setup(opts, function(result){
      res.send(result)
    })
  },

  // startWorkload: Starts specified workload
  //
  // Note that workload methods need to match string provided in
  //  params.name
  //  TODO: maybe support a client filter
  //
  startWorkload: function(req, res, next){

    workloads.start(req.params, clients, function(result){
      res.send(result)
    })
  },

  stopWorkload: function(req, res, next){

    workloads.stop(function(result){
      res.send(result)
    })
  },

  // startStatCollector:
  //
  // start following changes on monitor client and syncgateway
  //  also start stat reporter and periodic gateway loader
  //
  // expects the following params
  //
  // monitorClient : iosLiteserv client to monitor..ie http://localhost:5981/perf-db
  // gateway : gateway to measure
  // PerfDB : perf db for stat reporting
  //
  startStatCollector: function(req, res, next){

    var opts = setOptsFromParams(req.params)
    opts.gateway = setGatewayFromParams(req.params.gateway)

    statcollector.start(opts, function(result){
      res.send(result)
    })
  },

  stopStatCollector: function(req, res, next){
    statcollector.stop()
    res.send({ ok : 'ok' })
  },

  doCleanup: function(req, res, next){
    handler.stopLiteServs(null, null)
    handler.stopSyncGateways(null, null)
    rmdir(__dirname+"/../tmp")
    mkdir(__dirname+"/../tmp")
    clientPort = 59850
    gatewayPort = 9888
    res.send({ok : 'ok'})
  }

}


function getInstances(res, instances){

    async.map(instances, function(inst, cb){
      cb(null, inst.url)
      }, function(err, results){
        res.send({ok : results})
      })
}


function stopInstances(res, instances){
      async.map(instances, function(inst, cb){
          inst.kill()
          cb(null,inst.url)
        }, function(err, stopped){
          if(res != null)
            res.send({ok : stopped})
      })
}

function setOptsFromParams(opts){

  // overwrite perf config with external params
  for (var p in perfparams){
    perfparams[p] = opts[p] ? opts[p] : perfparams[p]
  }

  // add opts not in perf config
  for (var o in opts){
    if(!(opts[o] in perfparams)){
      perfparams[o] = opts[o]
    }
  }

  // these are rest-only options not exposed in a local config
  // and therefore may not have values at runtime
  perfparams.db = opts.db ? opts.db : "test-perf"
  perfparams.gatewaydb = opts.gatewaydb ? opts.gatewaydb : "db"
  perfparams.testid = opts.testid ? opts.testid : "perf_"+process.hrtime()[0]
  perfparams.runtime = opts.runtime ? opts.runtime : 300

  if(opts.enablepull === undefined){
    perfparams.enablepull = true
  } else {
    perfparams.enablepull = opts.enablepull
  }

/* unless you want to store important stats into a transient pouchdb
  if(!perfparams.perfdb){
    // use internal perfdb
    var adminPort = config.LocalListenerPort + 1
    var url = "http://"+config.LocalListenerIP+":"+adminPort+"/stats"
    perfparams.perfdb = url
  } */

  return perfparams
}

function setGatewayFromParams(gateway){

    var gateway = gateway

    if(!gateway){

      // try to use gateway from config
      if(perfparams.gateway){
        gateway = perfparams.gateway
      } else if (gateways.length > 0){
        // try to use created gateway
        gateway = activeGateway
      }
    }

    return gateway
}

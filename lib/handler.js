var async = require('async'),
    coax = require('coax'),
    phalanx = require('../lib/phalanx'),
    config = require('../config/local'),
    launcher = require('../lib/launcher');

var clients = [];
var gateways = [];
var clientPort = 59850
var gatewayPort = 9888

module.exports = {


  startLiteServClient : function (req, res, next) {

    if (req.params.port){
      clientPort = req.params.port
    } else {
      clientPort++
    }

    liteServPath = config.LiteServPath
    if(req.params.path){
      liteServPath = req.params.path
    }

    opts = {
      port : clientPort,
      dir : __dirname+"/../tmp/ls-"+clientPort,
      path : liteServPath
    }

    client = launcher.launchLiteServ(opts)

    client.once("error", function(err){
      client.kill()
      res.send({error : err+" "+url})
    })

    var url = "http://"+config.LocalListenerIP+":"+clientPort+"/"
    client.url = url

    client.once("ready", function(){
        coax(url, function(err, json){
        if(err) {
          res.send({error : "cannot reach: "+url+" "+err})
        }
        else {
          clients.push(client)
          res.send({ok: url})
        }
      })
    });
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

    console.log(opts)
    var url = "http://"+config.LocalListenerIP+":"+opts.port+"/"
    sg.url = url
    sg = launcher.launchSyncGateway(opts)

    sg.once("ready", function(err){
      if(err){
        res.send({error : err+url})
      }
      coax(url, function(err, ok){
        if(err){
          res.send({error : "Sync Gateway not reachable: "+opts.port})
        } else {
          gateways.push(sg)
          res.send({ok : url})
        }
      })
    })},

  stopLiteServs: function(req, res, next){
    stopInstances(res, clients)
  },


  stopSyncGateways: function(req, res, next){
    stopInstances(res, gateways)
  },

  getLiteServs: function(req, res, next){
    getInstances(res, clients)
  },

  getSyncGateways: function(req, res, next){
    getInstances(res, gateways)
  },
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
          instances = []
          res.send({ok : stopped})
      })
}


var async = require('async'),
    coax = require('coax'),
    rmdir = require("../lib/rmdir"),
    config = require('../config/local'),
    phalanx = require('../lib/phalanx'),
    launcher = require('../lib/launcher');

var ph, sg

module.exports = {

  startLiteServs: function (req, res, next) {

    rmdir(__dirname+"/../tmp")
    ph = phalanx.launchLiteServ(req.params.numclients, {
      port : config.LiteServBasePort,
      dir : __dirname+"/../tmp",
      path : config.LiteServPath
    })

    ph.once("error", function(err){
      ph.kill()
      req.send("error launching phalanx", err)
    })
    ph.once("ready", function(servers){
      async.map(ph.servers, function(url, cb) {
        coax(url, cb)
      }, function(err, mapped){
        if(err){
          res.send("unable to reach liteserv: "+url)
          }
        else{
          res.send("started "+req.params.numclients+" servers")
          }
      })
    });
  },

  stopLiteServs: function(req, res, next){
    running = 0
    if (ph){
      running = ph.liteservs.length
      ph.liteservs.forEach(function(client){client.kill()})
    }
    res.send("killed "+running+" clients")
  },

  startSyncGateway: function(req, res, next){

    var opts = {port : config.SyncGatewayBasePort,
                dir : __dirname+"/../tmp/sg",
                path : config.SyncGatewayPath,
                configPath : config.SyncGatewayAdminParty
        }
    var url = "http://localhost:"+opts.port+"/"
    sg = launcher.launchSyncGateway(opts)

    sg.once("ready", function(err){
      if(err){
        res.send("error, Sync Gateway not running on port: "+opts.port)
      }
      coax(url, function(err, ok){
        if(err){
          res.send("error, Sync Gateway not reachable on port: "+opts.port)
        } else {
          res.send("Sync Gateway running on port: "+opts.port)
        }
      })
    })},

  stopSyncGateway: function(req, res, next){
    if (sg){
      sg.kill()
    }
    res.send("done")
  }


}


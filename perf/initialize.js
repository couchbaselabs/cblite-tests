var  coax = require("coax"),
  async = require("async"),
  perfparams = require("../config/perf"),
  conf_file = process.env.CONF_FILE || 'local',
  config = require('../config/' + conf_file),
  listener = require("../lib/listener"),
  common = require("../tests/common");

var params = {}
var clientsPerProvider = 0
var gateway = null
var sginstance = null

// init:
//
// Takes params for initalizing providers
//   that expose client resources
// Current providers can spin up ios and pouchdb instances.
//   (android pending)
// Gateways can also be exposed by a provider
//
module.exports = function(opts, done){

  params = opts
  gateway = params.gateway

  var provisioned = function(errs, oks){
    done({error : errs, gateway : gateway})
  }

  if(params.providers.length > 0){
    clientsPerProvider = Math.floor(params.numClients/params.providers.length)
  }


  async.series([cleanup,
                internalStores,
                startClients,
                startSyncGateway],  provisioned)

}

// internalStores:
//
// Initialize internal database used to hold settings and stats
//   when perfdb is set the internal stat db is not used
//
function internalStores(cb){

    console.log("#create internal stores")
    var listener = "http://"+config.LocalListenerIP+":"+config.LocalListenerPort
    var adminPort = config.LocalListenerPort + 1
    coax.post([listener,"start","pouchdb"], {port : adminPort, internal : true}, function(err, json){
      if(err){
        cb({error : err}, "pouchdb")
      } else {

        var adminUrl = "http://"+config.LocalListenerIP+":"+adminPort

        /* create config and stat stores */
        async.mapSeries(["admin", "stats"], function(db, callback){
          coax.put([adminUrl, db], callback)
          }, function(err, oks){
          cb(err, {ok : 'internal stores'})
        })
      }

    })

}

// startClients:
//
function startClients(cb){


    if(params.providers == 0){
      cb(null, {ok : "no providers"})
    } else {

      async.map(params.providers, function(url, callback) {

        coax(url, function(e, js){
          if(!e){
            var type = js.provider
            console.log("#starting "+clientsPerProvider+" "+type+" clients")

            async.timesSeries(clientsPerProvider, function(n, next){
                   coax.post([url,"start",type,{}], next)
                 },
                 callback)
          } else {
            callback(e, null)
          }
          })
        }, function( err, results){
           cb(err, {ok : " initialzed "+results.length+" providers"})
      })
    }

}


// startSyncGateway:
//
function startSyncGateway(cb){

  if(gateway){

    // attempt to reach gateway
    coax([gateway], function(err, json){
      if(err){
        gateway = null
      }

     // gateway exists
     cb(err, {gateway : gateway })

    })
  } else {
    // start gateway
    common.launchSG(null, function(sg){
      sginstance = sg
      gateway = sg.url
      cb(null, {gateway : gateway})
    })
  }

}

// cleanup:
//
// all resources are stopped and tmp dir cleaned up
//
var cleanup = module.exports.cleanup = function(cb){

  console.log("#cleanup")

  async.mapSeries(params.providers, function(url, _cb){
      coax([url,"cleanup"], _cb)
  }, function(err, result){

    // kill sync gateway instance
    if(sginstance)
      sginstance.kill()

    setTimeout(function(){
      cb(err, {ok : "cleanup done"})
    }, 3000)
  })

}

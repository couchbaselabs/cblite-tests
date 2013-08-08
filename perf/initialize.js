var phalanx = require("../lib/phalanx"),
  coax = require("coax"),
  async = require("async"),
  test = require("tap").test,
  resources = require("../config/local").resources,
  config = require('../config/local'),
  listener = require("../lib/listener");

var params = {}
var clientsPerProvider = 0
var gateway = null

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
                startIOSClients,
                startPDBClients,
                startSyncGateway],  provisioned)

}

// internalStores:
//
// Initialize internal database used to hold settings and stats
//   when PerfDB is set the internal stat db is not used
//
function internalStores(cb){

    console.log("#create internal stores")
    var listener = "http://"+config.LocalListenerIP+":"+config.LocalListenerPort
    var adminPort = config.LocalListenerPort + 1
    coax.post([url,"start","embeddedclient"], {port : adminPort, internal : true}, function(err, json){
      if(err){
        cb({error : err}, "embeddedclient")
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

// startIOSClients:
//
function startIOSClients(cb){

    console.log("#start ios clients")

    if(resources.LiteServProviders.length == 0){
      cb(null, {ok : "no ios client provider"})
    } else {

      async.map(resources.LiteServProviders, function(url, callback) {

        async.timesSeries(clientsPerProvider, function(n, next){
               coax.post([url,"start","liteserv",{}], next)
             },
             callback)
          }, function( err, results){
             cb(err, {ok : " started "+results.length+" liteserv providers"})
      })
    }

}

// startPDBClients:
//
function startPDBClients(cb){

  console.log("#start embedded clients")

  if(resources.PouchDBProviders.length == 0){
    cb(null, {ok : "no embedded client provider"})
  } else {

    async.map(resources.PouchDBProviders, function(url, callback) {

      async.timesSeries(clientsPerProvider, function(n, next){
             coax.post([url,"start","embeddedclient",{}], next)
           },
           callback)
        }, function( err, results){
           cb(err, {ok : " started "+results.length+" embedded providers"})
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
    coax.post([resources.SyncGatewayProvider,"start","syncgateway"], {},
      function(err, json){

          if ('error' in json){
            err = json['error']
          }
          if(!err){
            gateway = json.ok
          }
          cb(err, {gateway : gateway})
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
    setTimeout(function(){
      cb(err, {ok : "cleanup done"})
    }, 3000)
  })

}

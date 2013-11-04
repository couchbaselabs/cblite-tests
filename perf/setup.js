var async = require("async"),
  coax = require("coax"),
  resources = require("../config/local").resources,
  common = require("../tests/common"),
  clientList = [],
  providers = [],
  gatewaydb = null,
  channelsPerClient = 0,
  numChannels = null,
  gateway = null;


// setup:
//
// Creates databases on all clients.
// Sets up push and pull replication
//   of all clients to sync gateway.
//
//
module.exports = function(params, done){

  console.log(params)
  gateway = params.gateway
  providers = params.providers
  gatewaydb = params.gatewaydb
  channelsPerClient = params.channelsPerClient
  numChannels = params.numChannels
  clients = {}

  var finished = function(errs,oks){

    if(params.enablepull){
      setupPullReplication(function(err, result){
        done({error : errs+err, ok : oks})
      })
    } else {
      done({error : errs, ok : oks})
    }
  }


  async.series([
    getEnvInfo,
    createDBs,
    setupPushReplication,
    createChannels,
  ], finished)

}


// getEnvInfo:
//
// initialize global client/gateway vars used for testing
// by querying providers for what resources are available
//
function getEnvInfo(done){

  async.map(providers, function(url, _cb){
    coax([url,"clients"],
      function(err, json){
        if(!err){
          clientList.push(json['ok'])
        }
        _cb(err,json)
    })
  }, function(err, results){
      done(err, {ok : "setup => "+clients.length+" clients, gateway: "+gateway})
  })

}


//  createDBs:
//
//  creates database on all clients
// TODO: expand to parameterize
//
function createDBs(done){

  console.log("create test-perf dbs on each client")

  if(clients.length == 0){
    done({err : 'no clients'}, null)
  }

  var i = 0
  async.map(clientList, function(clients, cb){
    async.mapSeries(clients, function(url, _cb){
      var db = "test-perf"+(i++)
      console.log(url+db)
      coax.put([url, db], _cb)
      }, cb)
  }, function(err, oks){
     done(err, {ok : "all dbs created"})
  })
}


// setupPullReplication:
//
function setupPullReplication(done){
  console.log("get all the clients pulling from the Sync Gateway")

  async.map(clientList, function(clients, cb){
    async.mapSeries(clients, function(url, _cb){

      coax([url, '_all_dbs'], function(err, dbs){

        if(!err){
          dbs.forEach(function(db){
            db = db.replace(/.*:\/\//,"")
            var opts = {
              continuous : true,
              target : db,
              source : coax([gateway,gatewaydb]).pax.toString()
            }
            if(channelsPerClient > 0){
              var chans = []
              do {
                    chans.push(common.randomChannelName())
              } while(chans.length < channelsPerClient)

              opts['query_params'] = {channels : chans.toString() }
              opts['filter'] =  "sync_gateway/bychannel"
            }
             console.log(opts)
            coax.post([url,"_replicate"], opts, _cb)
          })
        } else {
          cb(err, null)
        }
      })
    }, cb)
  }, function(err, oks){
        done(err, { ok : "all clients pulling" })
 })

}

// setupPushReplication:
//
function setupPushReplication(done){
  console.log("get all clients pushing with the Sync Gateway")

  var i = 0

  async.map(clientList, function(clients, cb){
    async.mapSeries(clients, function(url, _cb){

    coax([url, '_all_dbs'], function(err, dbs){

      if(!err){
        dbs.forEach(function(db){
          db = db.replace(/.*:\/\//,"")

          coax.post([url,"_replicate"], {
            continuous : true,
            source : db,
            target : coax([gateway, gatewaydb]).pax.toString()
          }, _cb)
        })
      } else {
        _cb(err, null)
      }
    })
  }, function(err, oks){
     var result = null
     if(!err){
       oks.forEach(function (ok) {
         if(!ok){
           err = "no session"
         } else if('session_id' in ok){
           result = ok.session_id //liteserv
         } else if ('ok' in ok){
           result = ok.ok //pouch
         } else {
           console.log(ok)
           err = "invalid session"
         }
       })
     }
       cb(err, {ok : result})
   })
  }, function(err, oks){
    done(err, oks)
 })

 }

function createChannels(done){

  console.log("create initial set of channels")
  var client = clientList[0][0]
  var generators = require("../tests/common").generators
  var doc_gen = generators.channels
  var chans = []

  // generate a document that will be pushed to all channels
  for (var i = 0; i < numChannels; i++){
    chans.push(String(i))
  }
  var doc = doc_gen(chans)

  // push to gateway
  coax.put([gateway, gatewaydb, "perfchanneldoc"], doc, function(err, json){

        if (err != null){
            console.log("ERROR Pushing channel doc: "+gateway+"/"+gatewaydb)
            console.log(err)
        }
        done(err,json)
  })

}

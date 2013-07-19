var phalanx = require("../lib/phalanx"),
  coax = require("coax"),
  async = require("async"),
  test = require("tap").test,
  resources = require("../config/local").resources,
  perf = require("../config/perf"),
  listener = require("../lib/listener");

var server;


module.exports.setup = function(){


  test("test start local listener", function(t){

      server = listener.start(function(url){
          console.log(url)
          coax(url, function(err, json){
              t.false(err, "http listener is running")
              t.end()
          })
      })

  })

  test("cleanup", function(t){
    cleanup(t, function(err, result){
        t.false(err, "cleanup done")

        /* wait until no clients remaining */
        setTimeout(function(){
           t.end()
        }, 8000)

    })

  });


  test("start liteservs",{timeout : 300000},  function(t){

    if(perf.numSyncClients > 0){
      async.map(resources.LiteServProviders, function(url, callback) {

        async.timesSeries(perf.numSyncClients, function(n, next){
               coax.post([url,"start","liteserv",{}], next)
             },
             callback)
          }, function( err, results){
             t.false(err, " started "+results.length+" liteserv clients")
             t.end()
      })
   } else { t.end() }

  });

  test("start embedded clients", {timeout : 300000},function(t){

    if (perf.numEmbClients > 0){
      async.map(resources.LiteServProviders, function(url, callback) {

        async.timesSeries(perf.numEmbClients, function(n, next){
               coax.post([url,"start","embeddedclient",{}], next)
             },
             callback)
          }, function( err, results){
             t.false(err, " started "+results.length+" embedded clients")
             t.end()
      })
   } else { t.end() }
  })

  test("start gateways", function(t){

      resources.SyncGatewayProviders.forEach(function(url){

        async.timesSeries(perf.numGateways, function(n, next){
            coax.post([url,"start","syncgateway", {}], function(err, json){
                if ('error' in json){
                  err = json['error']
                }
                next(err, 'ok' in json ? json['ok'] : err)
            })},
            function(err, results){
              t.false(err, results)
              t.end()
            })
      })
  });

}

module.exports.teardown = function(){

  test("cleanup", function(t){
    cleanup(t, function(err, result){
        t.false(err, "cleanup done")
        t.end()

    })
  })

  test("stop local listener", function(t) {
    server.close()
    t.end()
  });

}


function cleanup(t, cb){

  providers = resources.LiteServProviders.concat(resources.SyncGatewayProviders)

  async.mapSeries(providers, function(url, _cb){
      coax([url,"cleanup"], _cb)
  }, function(err, result){
    cb(err, "cleanup done")
  })

}

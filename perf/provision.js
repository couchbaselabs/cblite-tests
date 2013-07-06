var phalanx = require("../lib/phalanx"),
  coax = require("coax"),
  async = require("async"),
  test = require("tap").test,
  loop = require("nodeload/lib/loop"),
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

  test("start liteservs", function(t){


    resources.LiteServProviders.forEach(function(url){

      async.timesSeries(perf.numSyncClients, function(n, next){

          coax.post([url,"start","liteserv",{}],
            function(err, json){
                next(err, json.toString())
            })},
            function(err, results){
              t.false(err, results)
              t.end()
            })

    })


  });

  test("start gateways", function(t){

      resources.SyncGatewayProviders.forEach(function(url){

        async.timesSeries(perf.numGateways, function(n, next){
            coax.post([url,"start","syncgateway", {}], function(err, json){
                console.log(err)
                t.false(err, json.toString())
                t.end()
            })
        })
      })
  });

}

module.exports.teardown = function(){

  test("cleanup", function(t){

      providers = resources.LiteServProviders.concat(resources.SyncGatewayProviders)

      async.mapSeries(providers, function(url, cb){
          coax([url,"cleanup"], function(err, json){
            cb(err,json)
          })
      }, function(err, result){
        console.log(err)
        t.false(err, "cleanup done")
        t.end()
      })
  });

  test("stop local listener", function(t) {
    server.close()
    t.end()
  });

}

var phalanx = require("../lib/phalanx"),
  coax = require("coax"),
  async = require("async"),
  test = require("tap").test,
  loop = require("nodeload/lib/loop"),
  rmdir = require("../lib/rmdir"),
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

    rmdir(__dirname+"/../tmp")

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

  test("stop liteservs", function(t) {

    if (resources.LiteServProviders.length > 0){
      resources.LiteServProviders.forEach(function(url){
          coax([url,"stop","liteservs"], function(err, json){
              t.false(err, json)
              t.end()
          })
      })
    } else {
      t.end()
    }
  })



  test("stop gateways", function(t){

      resources.SyncGatewayProviders.forEach(function(url){
          coax([url,"stop","syncgateways"], function(err, json){
              t.false(err, "stopped sync_gateway on url: "+url)
              t.end()
          })
      })
  });


  test("stop local listener", function(t) {
    server.close()
    t.end()
  });

}

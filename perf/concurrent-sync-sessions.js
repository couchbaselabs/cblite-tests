var phalanx = require("../lib/phalanx"),
  async = require("async"),
  coax = require("coax"),
  test = require("tap").test,
  resources = require("../config/local").resources,
  perf = require("../config/perf"),
  provision = require('./provision');

var writeRateFullMesh = require("./workloads/write-rate-full-mesh")
var clients = []
var gateways = []

if (resources.Provision== true){
  provision.setup()
}


test("init", function(t){
  async.series({
    set_clients: function(cb){
      async.map(resources.LiteServProviders, function(url, _cb){
        coax([url,"liteservs"],
          function(err, json){
            if(!err)
            clients = clients.concat(json['ok'])
            _cb(err,json)
        })
      }, function(err, results){ cb(err,results) })
    },
    set_gateways: function(cb){
      async.map(resources.SyncGatewayProviders, function(url, _cb){
        coax([url,"syncgateways"],
          function(err, json){
            if(!err)
            gateways = gateways.concat(json['ok'])
            _cb(err,'ok')
      })
    }, function(err, results){ cb(err,results) })
    }
  }, function(err, results){
     t.false(err, "setup => "+clients.length+" clients, "+gateways.length+" gateways")
     t.end()
  })
})

test("create test-perf dbs on each client", function(t){
  async.map(clients, function(url, cb){
    coax.put([url,"test-perf"], cb)
    }, function(err, oks){
    t.equals(null,err,"all dbs created")
    t.end()
  })
})

test("get all the clients pushing with the Sync Gateway", function(t){

  async.map(clients, function(url, cb){
    coax.post([url,"_replicate"], {
      source : "test-perf",
      target : coax([gateways[0],"db"]).pax.toString()
    }, cb)
  }, function(err, oks){
    t.equals(null,err,"all clients pushing")
    oks.forEach(function (ok) {
      t.ok(ok.session_id, "has a session")
    })
    t.end()
  })

})

test("get all the clients pulling from the Sync Gateway", function(t){
  async.map(clients, function(url, cb){
    coax.post([url,"_replicate"], {
      target : "test-perf",
      source : coax([gateways[0],"db"]).pax.toString()
    }, cb)
  }, function(err, oks){
    // console.log("all clients pulling",oks)
    t.equals(null,err,"all clients pulling")
    t.end()
  })
})


test("this is where you could plug in different workloads", function(t){
  // write docs to clients
  // ensure they show up on other clients
  writeRateFullMesh(t,
    clients.map(function(url){return coax([url,"test-perf"]).pax.toString()}),
    coax([gateways[0],"db"]).pax.toString(),
    perf.clientWriteDelay,
    perf.runSeconds,
    t.end.bind(t))
})


if (resources.Provision== true){
  provision.teardown()
}

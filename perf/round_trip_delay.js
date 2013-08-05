var phalanx = require("../lib/phalanx"),
  async = require("async"),
  coax = require("coax"),
  test = require("tap").test,
  resources = require("../config/local").resources,
  perf = require("../config/perf"),
  provision = require('./provision');

var writeConcurrentLoader = require("./workloads/concurrent_writer")
var clients = []
var gateways = []
var pull_client

if (resources.Provision== true){
  provision.setup()
}

test("init", function(t){
  var providers = resources.LiteServProviders
  var i, len;
  for (i = 0, len = resources.PouchDBProviders.length; i < len; ++i) {
    var pdb = resources.PouchDBProviders[i]
    providers.concat(resources.PouchDBProviders[i])
    if (!pdb  in providers ){
      providers.concat(pdb)
    }
  }

  clientProviders = resources.LiteServProviders
  async.series({
    set_clients: function(cb){
      async.map(clientProviders, function(url, _cb){
        coax([url,"clients"],
          function(err, json){
            if(!err){
              clients = clients.concat(json['ok'])
            }
            _cb(err,json)
        })
      }, function(err, results){ cb(err,results) })
    },
    set_gateways: function(cb){
      async.map(resources.SyncGatewayProviders, function(url, _cb){

        coax([url,"syncgateways"],
          function(err, json){
            if(!err){
              gateways = gateways.concat(json['ok'])
            }
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

test("get all the clients pulling from the Sync Gateway", function(t){

  console.log(clients)
  async.map(clients, function(url, cb){
    coax.post([url,"_replicate"], {
      continuous : true,
      target : "test-perf",
      source : coax([gateways[0],"db"]).pax.toString()
    }, cb)
  }, function(err, oks){
    t.equals(null,err,"all clients pulling")
    t.end()
  })
})


test("get all clients pushing with the Sync Gateway", { timeout : 300000 }, function(t){

  async.map(clients, function(url, cb){
    coax.post([url,"_replicate"], {
      continuous : true,
      source : "test-perf",
      target : coax([gateways[0],"db"]).pax.toString()
    }, cb)
  }, function(err, oks){
    t.equals(null,err,"all clients pushing")
    oks.forEach(function (ok) {
      if(!ok){
        t.fail("has a session")
      } else if('session_id' in ok){
        t.ok(ok.session_id, "has a session") //liteserv
      } else if ('ok' in ok){
        t.equals(ok.ok, true, "has a session") //pouch
      } else {
        t.fail("has a session")
      }
    })
    t.end()
  })

})

test("start N client perf test", {timeout : perf.runSeconds*2000}, function(t){
  writeConcurrentLoader(clients.map(function(url){return coax([url,"test-perf"]).pax.toString()}),
  		      coax([gateways[0],"db"]).pax.toString(),
            perf,
            function(){ t.end() })
})

test("teardown", function(t){
  if (resources.Provision == true){
     provision.teardown()
  }
  t.end()
})

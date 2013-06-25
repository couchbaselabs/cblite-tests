// use the liteserve phalanx and the sync-gateway launcher to apply concurrent sync sessions to a sync sync-gateway

var phalanx = require("../lib/phalanx"),
  rmdir = require("../lib/rmdir"),
  launcher = require("../lib/launcher"),
  async = require("async"),
  coax = require("coax"),
  config = require("../config/local"),
  perf = require("../config/perf"),
  test = require("tap").test;

var ph, sg;

test("create a phalanx of "+perf.numSyncClients+" LiteServs", function(t) {
  rmdir(__dirname+"/../tmp") // synchronously
  ph = phalanx.launchLiteServ(perf.numSyncClients, {
    port : 59850,
    dir : __dirname+"/../tmp",
    path : config.LiteServPath
  })
  ph.on("ready", function(){
    t.equals(ph.servers.length, perf.numSyncClients, "all of them started")
    t.end()
  });
});

test("launch a Sync Gateway", function(t) {
  sg = launcher.launchSyncGateway({
    port : 9888,
    dir : __dirname+"/../tmp/sg",
    path : config.SyncGatewayPath,
    configPath : config.SyncGatewayAdminParty
  })
  sg.once("ready", function(err){
    t.false(err, "no error, Sync Gateway running on our port")
    sg.db = coax([sg.url,"db"])
    sg.db(function(err, ok){
      t.false(err, "no error, Sync Gateway reachable")
      t.end()
    })
  });
});

test("create test-perf dbs on each client", function(t){
  async.map(ph.servers, function(url, cb){
    coax.put([url,"test-perf"], cb)
  }, function(err, oks){
    t.equals(null,err,"all dbs created")
    t.end()
  })
})

test("get all the clients pushing with the Sync Gateway", function(t){
  async.map(ph.servers, function(url, cb){
    coax.post([url,"_replicate"], {
      source : "test-perf",
      target : coax([sg.url,"db"]).pax.toString()
    }, cb)
  }, function(err, oks){
    t.equals(null,err,"all clients pushing")
    t.end()
  })
})

test("get all the clients pulling from the Sync Gateway", function(t){
  async.map(ph.servers, function(url, cb){
    coax.post([url,"_replicate"], {
      target : "test-perf",
      source : coax([sg.url,"db"]).pax.toString()
    }, cb)
  }, function(err, oks){
    t.equals(null,err,"all clients pulling")
    t.end()
  })
})

test("this is where you could plug in different workloads", function(t){
  t.end()
})

test("exit", function(t) {
  ph.kill()
  sg.kill()
  t.end()
})


// each device follows N channels
// each device writes to N*N channels
// total channel space of (N channels * N devices)^2

// for each write  to a liteserv, time how long it takes to show up on
// the changes feeds of other devices that are following the channels
// it wrote to. Also make sure the document is not on devices
// that aren't allowed to see those channels.

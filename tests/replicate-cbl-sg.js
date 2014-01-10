
var launcher = require("../lib/launcher"),
  phalanx = require("../lib/phalanx"),
  coax = require("coax"),
  async = require("async"),
  conf_file = process.env.CONF_FILE || 'local',
  config = require('../config/' + conf_file),
  test = require("tap").test,
  replicateClientServerClient = require("./subtests/replicate-client-server-client")

var sg, ph;

test("launch 2 LiteServs", function(t) {
  ph = phalanx.launchLiteServ(2, {
    port : 59845,
    dir : __dirname+"/../tmp",
    path : config.LiteServPath
  })
  ph.once("ready", function(){
    async.map(ph.servers, coax, function(err, oks){
      t.false(err, "all servers reachable")
      t.end()
    })
  });
  ph.once("error", function(err){
    ph.kill()
    t.fail()
    console.log("error launching phalanx", err)
    process.exit()
  })
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
    sg.db = coax([sg.url, config.DbBucket])
    sg.db(function(err, ok){
      t.false(err, "no error, Sync Gateway reachable")
      t.end()
    })
  });
});

test("create test databases", function(t) {
  createDbs(["test-repl","test-http1","test-http2","test-http3",
             "test-local1","test-local2","test-local3"], function(err, oks){
    t.false(err,"all dbs created")
    t.end()
  })
})


test("replicate between all 3 servers", function(t){
  var dbs = [
  coax([ph.servers[0], "test-repl"]),
  sg.db,
  coax([ph.servers[1], "test-repl"])];
  //console.log("servers", dbs);
  replicateClientServerClient(t, dbs, t.end.bind(t))
})


test("_local to _local over http", function(t){

  var dbs = [
  coax([ph.servers[0], "test-http1"]),
  coax([ph.servers[0], "test-http3"]),
  coax([ph.servers[0], "test-http2"])];
  replicateClientServerClient(t, dbs, t.end.bind(t))
})

test("_local to _local over native", function(t){

  var dbs = [
  coax([ph.servers[0], "test-local1"]),
  coax([ph.servers[0], "test-local3"]),
  coax([ph.servers[0], "test-local2"])];
  replicateClientServerClient(t, dbs, t.end.bind(t), { http : false })
})

test("exit", function(t){
  sg.kill()
  ph.kill()
  t.end()
})


function  createDbs(dbs, done){

  async.mapSeries(dbs, function(db, next){
    async.map(ph.servers, function(url, cb){
      /* check if db exists */
      coax([url,db], function(err, json){
          if(!err){
              /* delete db */
              coax.del([url, db], function(err, json){
                  if(err){
                    cb(err, json)
                  } else {
                    coax.put([url, db], cb)
                  }
              });
          } else {
              coax.put([url, db], cb)
          }
      });
      }, next)
    }, function(err, oks){
          done(err, oks)
    })
}

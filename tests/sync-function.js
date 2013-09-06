var launcher = require("../lib/launcher"),
  coax = require("coax"),
  config = require("../config/local.js"),
  test = require("tap").test;

var serve, port = 8888, server = "http://localhost:"+port+"/", adminUrl = "http://localhost:"+(port+1)+"/"

test("can launch a Sync Gateway", function(t) {
  serve = launcher.launchSyncGateway({
    port : port,
    dir : __dirname+"/../tmp/syncfun",
    path : config.SyncGatewayPath,
    configPath : config.SyncGatewaySyncFunctionTest
  })
  serve.once("ready", function(err){
    t.false(err, "no error, Sync Gateway running on our port")
    coax(server, function(err, ok){
      t.false(err, "no error, Sync Gateway reachable")
      coax(adminUrl, function(err, ok) {
        t.false(err, "no error, admin port reachable")
        t.end()
      })
    })
  });
});
var adminDb;
var userUrl;
test("create users", function(t){
  adminDb = coax([adminUrl, "db"])
  var users = {
    "coolio" : {"password":"coolio", "admin_channels" : ["voyage"]},
    "norm" : {"password":"norm", "admin_channels" : ["etc"]},
  }
  adminDb.put(["_user",'coolio'], users.coolio, function(err, ok) {
    t.false(err, "no error, set user coolio")
    userUrl = "http://coolio:coolio@localhost:"+port+"/"
    adminDb.put(["_user",'norm'], users.norm, function(err, ok) {
      t.false(err, "no error, set user norm")
      normUrl = "http://norm:norm@localhost:"+port+"/"
      t.end()
    })
  })
})

test("can get db info", function(t){
  coax([userUrl, "db"]).get(function(err, ok){
    t.ok(ok, "created database")
    t.equals(ok.db_name, "db", "correct name")
    coax([normUrl, "db"]).get(function(err, ok){
      t.ok(ok, "created database")
      t.equals(ok.db_name, "db", "correct name")
      t.end()
    })
  })
})

test("requireAccess", function(t){
  // can't write to channels you can't acccess
  var doc = {channels:["norm-will-make"]}
  coax.put([normUrl, "db", "normsdoc"], doc, function(err, ok){
    console.log("put1", err)
    t.ok(err, "shouldn't allow write")

    // resave to grant norm access to the channel
    doc.subscribe = "norm"
    coax.put([normUrl, "db", "normsdoc"], doc, function(err, ok){
      console.log("put2", err)
      t.false(err, "should allow write")
      var doc2 = {channels:["norm-will-make"]}
      coax.put([normUrl, "db", "normsdoc2"], doc2, function(err, ok){
        console.log("put3", err)
        t.false(err, "should allow write")
        t.end()
      })
    })
  })
})

test("exit", function(t) {
  serve.kill()
  t.end()
})

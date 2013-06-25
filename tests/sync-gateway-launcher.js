var launcher = require("../lib/launcher"),
  coax = require("coax"),
  config = require("../config/local.js"),
  test = require("tap").test;

var serve, port = 8888, server = "http://localhost:"+port+"/"

test("can launch a Sync Gateway", function(t) {
  serve = launcher.launchSyncGateway({
    port : port,
    dir : __dirname+"/../tmp/sg",
    path : config.SyncGatewayPath,
    configPath : config.SyncGatewayAdminParty
  })
  serve.once("ready", function(err){
    t.false(err, "no error, Sync Gateway running on our port")
    coax(server, function(err, ok){
      t.false(err, "no error, Sync Gateway reachable")
      t.end()
    })
  });
});

test("can get db info", function(t){
  coax([server, "db"]).get(function(err, ok){
    t.ok(ok, "created database")
    t.equals(ok.db_name, "db", "correct name")
    t.end()
  })
})
test("can write and read", function(t) {
  var doc = coax([server, "db", "docid"])
  console.log(doc.pax.toString())
  doc.put({"ok":true}, function(err, ok){
    console.log(err, ok)
    t.false(err, "saved")
    t.equals(ok.id, "docid")
    doc.get(function(err, ok){
      t.false(err, "loaded")
      t.end()
    })
  })

})

test("exit", function(t) {
  serve.kill()
  t.end()
})

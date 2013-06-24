var launcher = require("./lib/launcher"),
  coax = require("coax"),
  config = require("./config"),
  test = require("tap").test;

var serve, port = 8888, server = "http://localhost:"+port+"/"

test("can launch a Sync Gateway", function(t) {
  serve = launcher.launchSyncGateway({
    port : port,
    dir : __dirname+"/tmp/sg",
    path : config.SyncGatewayPath,
    configPath : config.SyncGatewayConfigPath
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
    if (err) {
      t.equals(412, err.status, "database exists")
    } else {
      t.ok(ok, "created database")
      t.equals(ok.db_name, "db", "correct name")
    }
    serve.kill()
    t.end()
  })
})

var launcher = require("../lib/launcher"),
  coax = require("coax"),
  config = require("../config/local"),
  test = require("tap").test;

var serve, port = 59850, server = "http://localhost:"+port+"/"

test("can launch a LiteServ", function(t) {
  serve = launcher.launchLiteServ({
    port : port,
    dir : __dirname+"/../tmp/single",
    path : config.LiteServPath
  })
  serve.on("error", function(e){
    console.log("error launching LiteServe", e)
    t.fail("error launching LiteServe")
    t.end()
  })
  serve.once("ready", function(err){
    t.false(err, "no error, LiteServe running on our port")
    coax(server, function(err, ok){
      t.false(err, "no error, LiteServe reachable")
      t.end()
    })
  });
});

test("can create a database", function(t){
  coax([server, "testdb"]).put(function(err, ok){
    if (err) {
      t.equals(412, err.status, "database exists")
    } else {
      t.ok(ok, "created database")
    }
    serve.kill()
    t.end()
  })
})

var launcher = require("../lib/launcher"),
  coax = require("coax"),
  conf_file = process.env.CONF_FILE || 'local',
  config = require('../config/' + conf_file),
  test = require("tap").test;

var serve, port = 59850
if(config.provides == "android"){
	 port = 8080
}
	server = "http://localhost:"+port+"/"

test("can launch a LiteServ", {timeout : 60000}, function(t) {
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
      t.false(err, "no error, LiteServe reachable" +err)
      t.end()
    })
  });
});

test("can create a database", function(t){
  coax([server, "testdb"]).del(function(err, ok) {
    coax([server, "testdb"]).put(function(err, ok){
      if (err) {
        t.equals(412, err.status, "database exists")
      } else {
        t.ok(ok, "created database")
      }
      t.end()
    })
  })
})


test("changes only show up once in longpoll", function(t) {
  var db = coax([server, "testdb"]);
  var count = 0;
  db.changes(function(err, change){
    if (err) return; // sometimes get an error on disconnect
    count++
    // console.log("change",err,change)
    t.equals(1, change.seq)
    t.equals(1, count, "each change should happen once")
  })
  db.post({"foo":"bar"}, function(err, ok){
    t.false(err, "saved ok")
  })
  t.end()
})

test("done", function(t) {
	serve.kill()
	t.end()
	if (config.provides=="android") process.exit()
})
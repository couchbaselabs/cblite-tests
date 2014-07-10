var launcher = require("../lib/launcher"),
  coax = require("coax"),
  conf_file = process.env.CONF_FILE || 'local',
  config = require('../config/' + conf_file),
  test = require("tap").test;

var serve, port = 8888, server = "http://localhost:"+port+"/"
var admin_server = "http://localhost:"+(port+1)+"/"

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
  coax([server, config.DbBucket]).get(function(err, ok){
    t.ok(ok, "created database")
    t.equals(ok.db_name, config.DbBucket, "correct name")
    t.end()
  })
})

test("can write and read", function(t) {
  var doc = coax([server, config.DbBucket, "docid"])
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

test("can write and read in admin server", function(t) {
  var doc = coax([admin_server, config.DbBucket, "admin_docid"])
  console.log(doc.pax.toString())
  doc.put({"ok":true}, function(err, ok){
    console.log(err, ok)
    t.false(err, "saved")
    t.equals(ok.id, "admin_docid")
    doc.get(function(err, ok){
      t.false(err, "loaded")
      t.end()
    })
  })
})


test("longpoll feed", function(t){
  var docInterval, db = coax([server, config.DbBucket])
  db.get(["_changes",{feed : "longpoll"}], function(err, changes) {
    // console.log(changes)
    t.false(err, "got changes")
    t.ok(changes.results, "results array")
    db.get(["_changes",{feed : "longpoll", since : changes.last_seq}], function(err, newchanges) {
      // console.log(newchanges)
      t.false(err, "got changes")
      t.ok(newchanges.results, "results array")
      console.log("last_seq", newchanges.last_seq)

      db.get(["_changes",{feed : "longpoll", since : newchanges.last_seq}], function(err, newchanges2) {
        // console.log(newchanges2)
        t.false(err, "got changes")
        t.ok(newchanges2.results, "results array")
        console.log("last_seq", newchanges2.last_seq)
        if (docInterval) {clearInterval(docInterval)}
        t.end()
      })

    })

  })
  var docidCount = 0;
  docInterval = setInterval(function(){
    for (var i = 10 - 1; i >= 0; i--) {
      db.put("newchange"+docidCount,{"ok":true}, function(err, ok){
        t.false(err, "put doc")
        // t.ok(ok.id, "newchange"+docidCount)
      });
      docidCount++
    }
  }, 100)
})

test("cleanup cb bucket", function(t){
    if (config.DbUrl.indexOf("http") > -1){
    coax.post([config.DbUrl + "/pools/default/buckets/" + config.DbBucket + "/controller/doFlush"],
	    {"auth":{"passwordCredentials":{"username":"Administrator", "password":"password"}}}, function (err, js){
	      t.false(err, "flush cb bucket")
	    },
	    setTimeout(function(){
		 t.end()
	            }, 5000))
	}else{
	    t.end()
	}
})

test("exit", function(t) {
  serve.kill()
  t.end()
})

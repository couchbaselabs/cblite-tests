var phalanx = require("../lib/phalanx"),
  rmdir = require("../lib/rmdir"),
  async = require("async"),
  coax = require("coax"),
  conf_file = process.env.CONF_FILE || 'local',
  config = require('../config/' + conf_file),
  test = require("tap").test;

var replicateClientServerClient = require("./subtests/replicate-client-server-client")

//https://github.com/couchbaselabs/LiteServAndroid/issues/7
//need the ability to run multiple instances
//all android tests should be uncommented when the the issue will be resolved

var ph, port = 59810, size = 3;

if (config.provides == "android") {
	 console.log("Skipping phalanx tests on Android")
	}

test("can launch a phalanx of LiteServ", function(t) {
	if (config.provides == "android") {
		 console.log("Skipping phalanx tests on Android")
		 t.end()
		} else{
  rmdir(__dirname+"/../tmp") // synchronously
  ph = phalanx.launchLiteServ(size, {
    port : port,
    dir : __dirname+"/../tmp",
    path : config.LiteServPath
  })

  ph.once("error", function(err){
    ph.kill()
    t.fail()
    console.log("error launching phalanx", err)
    process.exit()
  })
  ph.once("ready", function(servers){
    t.ok(ph.servers, "servers exist")
    t.equals(size, servers.length, "correct number of servers")
    t.equals(size, ph.servers.length, "correct number of servers")
    async.map(ph.servers, function(url, cb) {
      // console.log("url", url)
      coax(url, cb)
    }, function(err, mapped){
      // console.log("ss", err, mapped)
      t.false(err, "all servers reachable")
      mapped.forEach(function(m){t.ok(m.version)})
      t.end()
    })
  });
}
});

test("setup test databases", function(t){
	if (config.provides == "android") {
		 console.log("Skipping phalanx tests on Android")
		 t.end()
		} else{
  async.map(ph.servers, function(url, cb) {
    var db = coax([url,"phalanx-test"])
    console.log("coax", db.pax)
    db.del(function(err, ok){
      db.put(function(err, ok) {
        db(function(err,ok){
          // console.log("get", db.pax, err)
          cb(err, ok)
        })
      })
    })
  }, function(err, mapped){
    t.false(err, "all dbs reachable")
    mapped.forEach(function(m){
      t.equals("phalanx-test", m.db_name, "created")
      t.equals(0, m.doc_count, "created")
    })
    t.end()
  })
		}
})

test("replicate between all " + size +" servers", function(t){
	if (config.provides == "android") {
		 console.log("Skipping phalanx tests on Android")
		 t.end()
		} else{
  var dbs = ph.servers.map(function(server) {return coax([server, "phalanx-test"])})
  replicateClientServerClient(t, dbs, t.end.bind(t))
		}
})


test("exit", function(t){
	if (config.provides == "android") {
		 console.log("Skipping phalanx tests on Android")
		 t.end()
		} else{
			ph.kill()
			t.end()
		}
})

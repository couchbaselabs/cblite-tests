var phalanx = require("./lib/phalanx"),
  rmdir = require("./lib/rmdir"),
  async = require("async"),
  coax = require("coax"),
  config = require("./config"),
  test = require("tap").test;

var ph, port = 59800, size = 3;

test("can launch a phalanx of LiteServ", function(t) {
  rmdir(__dirname+"/tmp") // synchronously
  ph = phalanx.launchLiteServ(size, {
    port : port,
    dir : __dirname+"/tmp",
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
});

test("empty test databases", function(t){
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
})

function loadDb(db, count, done) {
  async.times(count, function(i,cb){
    db.post({_id:"i"+i}, cb)
  }, done)
}

function verifyDb(db, count, done) {
  async.times(count, function(i,cb){
    db.get("i"+i, cb)
  }, done)
}

test("load a test database", function(t){
  var db = coax([ph.servers[0], "phalanx-test"])
  db.put(function(err, ok){
    db.get(function(err, ok){
      t.equals(ok.db_name, "phalanx-test", "ready to load")
      loadDb(db, 50, function(err, oks){
        t.equals(err, null, "all ok")
        t.end()
      })
    })
  })
})

test("verify the database", function(t){ // assumes "load a test database" just ran
  var db = coax([ph.servers[0], "phalanx-test"])
  verifyDb(db, 50, function(err, ok){
    t.equals(err, null, "all ok")
    t.end()
  })
})

test("can pull replicate LiteServ to LiteServ", function(t){
  var source = coax([ph.servers[0], "phalanx-test"])
    // target = coax([ph.servers[1], "phalanx-test"]),
    // replicator = coax([, "_replicate"])

  coax(ph.servers[1]).post("_replicate", {
    source : source.pax.toString(),
    target : "phalanx-test"
  }, function(err, ok){
    t.equals(err, null, "replicating")
    t.end()
  })
})


test("verify the pull target", function(t){ // assumes "can pull replicate LiteServ to LiteServ" just ran
  var db = coax([ph.servers[1], "phalanx-test"])
  verifyDb(db, 50, function(err, ok){
    t.equals(err, null, "all replicated")
    t.end()
  })
})

test("can push replicate LiteServ to LiteServ", function(t){
  var target = coax([ph.servers[2], "phalanx-test"])
  coax(ph.servers[0]).post("_replicate", {
    target : target.pax.toString(),
    source : "phalanx-test"
  }, function(err, ok){
    t.equals(err, null, "replicating")
    t.end()
  })
})

test("verify the push target", function(t){ // assumes "can pull replicate LiteServ to LiteServ" just ran
  var db = coax([ph.servers[2], "phalanx-test"])
  verifyDb(db, 50, function(err, ok){
    t.equals(err, null, "all replicated")
    t.end()
  })
})

test("exit", function(t){
  ph.kill()
  t.end()
})

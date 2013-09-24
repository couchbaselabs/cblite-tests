var launcher = require("../lib/launcher"),
  coax = require("coax"),
  async = require("async"),
  tstart = process.hrtime(),
  common = require("../tests/common"),
  util =  require("util"),
  eventEmitter = common.ee,
  emitsdefault  = "default",
  test = require("tap").test;

var server, sg, gateway,
  // local dbs
 dbs = ["api-test-once-push"],
 pulldbs = ["api-test-once-pull"];

// start client endpoint
test("start test client", function(t){
  common.launchClient(t, function(_server){
    server = _server
    t.end()
  })
})

// start sync gateway
test("start syncgateway", function(t){
  common.launchSG(t, function(_sg){
    sg  = _sg
    gateway = sg.url
    t.end()
  })
})

// create all dbs
test("create test databases", function(t){
  common.createDBs(t, dbs.concat(pulldbs))
})

test("load databases", function(t){
  common.createDBDocs(t, {numdocs : 100, dbs : dbs})
})

test("push replication should close connection on completion", function(t) {
  var sgdb = sg.db.pax().toString()
  var lite = dbs[0]

  coax.post([server, "_replicate"], {
    source : lite,
    target : sgdb
  }, function(err, info) {
    t.false(err, "replication created")
    console.log("info", info)
    sg.db.get(function(err, dbinfo){
      t.false(err, "sg database exists")
      t.ok(dbinfo, "got an info repsonse")
      t.equals(100, dbinfo.doc_count, "all docs replicated")
      t.end()
    })
  })
})


test("pull replication should close connection on completion", function(t) {
  var sgdb = sg.db.pax().toString()
  var lite = pulldbs[0]

  coax.post([server, "_replicate"], {
    source : sgdb,
    target : lite
  }, function(err, info) {
    t.false(err, "replication created")
    // console.log("info", info)
    coax([server, lite], function(err, dbinfo){
      t.false(err, "lite database exists")
      t.ok(dbinfo, "got an info repsonse")
      console.log("lite dbinfo", dbinfo, coax([server, lite]).pax().toString())
      if (dbinfo)
        t.equals(100, dbinfo.doc_count, "all docs replicated")
      t.end()
    })
  })
})

test("done", function(t){
  common.cleanup(t, function(json){
    sg.kill()
    t.end()
  })
})

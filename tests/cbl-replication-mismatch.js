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
 dbs = ["mismatch-test-one", "mismatch-test-two"];

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
  common.createDBs(t, dbs)
})

function setupPushAndPull(server, dba, dbb, cb) {
  coax.post([server, "_replicate"], {
    source : dba,
    target : dbb,
    continuous : true
  }, function(err, info) {
    if (err) {return cb(err)}
    coax.post([server, "_replicate"], {
      source : dbb,
      target : dba,
      continuous : true
    }, cb)
  })
}

test("setup continuous push and pull from both client database", function(t) {
  var sgdb = sg.db.pax().toString()
  var lite = dbs[0]

  // sgdb = "http://sync.couchbasecloud.com:4984/guestok92"

  setupPushAndPull(server, dbs[0], sgdb, function(err, ok){
    t.false(err, 'replication one ok')
    setupPushAndPull(server, dbs[1], sgdb, function(err, ok){
      t.false(err, 'replication two ok')
      t.end()
    })
  })
})


test("load databases", function(t){
  common.createDBDocs(t, {numdocs : 500, dbs : dbs})
})

test("verify dbs have same number of docs", function(t) {
  common.verifyNumDocs(t, dbs, 1000)
})

test("done", function(t){
  common.cleanup(t, function(json){
    sg.kill()
    t.end()
  })
})

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

var sgdb;
test("setup continuous push and pull from both client database", function(t) {
  sgdb = sg.db.pax().toString()
  var lite = dbs[0]

  // sgdb = "http://sync.couchbasecloud.com:4984/guestok64"

  setupPushAndPull(server, dbs[0], sgdb, function(err, ok){
    t.false(err, 'replication one ok')
    setupPushAndPull(server, dbs[1], sgdb, function(err, ok){
      t.false(err, 'replication two ok')
      t.end()
    })
  })
})


test("load databases", function(t){
  common.createDBDocs(t, {numdocs : 500, dbs : dbs, docgen : "channels"})
})

test("verify dbs have same number of docs", {timeout: 120 * 1000}, function(t) {
  common.verifyNumDocs(t, dbs, 1000)
})

test("verify sync gateway changes feed has all docs in it", function(t) {
  var db = coax(sgdb)
  db("_changes", function (err, data) {
    var changes = data.results.map(function(r){return r.id});
    db("_all_docs", function(err, view){
      var docs = view.rows;
      var missing = [];

      docs.forEach(function(d){
        if (changes.indexOf(d.id) == -1) {
          missing.push(d.id)
        }
      })

      var changeIds = {}, dupIds = [];
      var changeSeqs = {}, dupSeqs = [];

      data.results.forEach(function(r){
        if (changeIds[r.id]) {
          dupIds.push(r.id)
        }
        changeIds[r.id] = true

        if (changeSeqs[r.seq]) {
          dupSeqs.push(r.seq)
        }
        changeSeqs[r.seq] = true
      })

      t.equals(docs.length, 1000, "correct number of docs in _all_docs")
      t.equals(changes.length, 1000, "correct number of docs in _changes")
      t.equals(dupIds.length, 0, "duplicate ids in changes")
      t.equals(dupSeqs.length, 0, "duplicate seqs in changes")
      t.equals(0, missing.length, "missing changes")

      console.log("missing "+missing.length+", ids:", missing.join(', '))
      console.log("duplicate change ids "+dupIds.length+", ids:", dupIds.join(', '))
      console.log("duplicate change seqs "+dupSeqs.length+", seqs:", dupSeqs.join(', '))

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

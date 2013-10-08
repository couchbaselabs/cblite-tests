var launcher = require("../lib/launcher"),
  coax = require("coax"),
  async = require("async"),
  tstart = process.hrtime(),
  common = require("../tests/common"),
  util =  require("util"),
  eventEmitter = common.ee,
  emitsdefault  = "default",
  test = require("tap").test;

var numDocs=(config.numDocs || 100)*5;

var server, sg, gateway, sgdb
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


test("setup continuous push and pull from both client database", function(t) {
  sgdb = sg.db.pax().toString()

  // sgdb = "http://sync.couchbasecloud.com:4984/guestok64"

  common.setupPushAndPull(server, dbs[0], sgdb, function(err, ok){
    t.false(err, 'replication one ok')
    common.setupPushAndPull(server, dbs[1], sgdb, function(err, ok){
      t.false(err, 'replication two ok')
      t.end()
    })
  })
})


test("load databases", function(t){
  t.equals(numDocs/2, Math.floor(numDocs/2), "numDocs must be an even number")
  common.createDBDocs(t, {numdocs : numDocs/2, dbs : dbs, docgen : "channels"})
})

test("verify dbs have same number of docs", {timeout: 210 * 1000}, function(t) {
  common.verifyNumDocs(t, dbs, numDocs)
})

var sg_doc_ids;
test("verify sync gateway changes feed has all docs in it", {timeout: 120 * 1000}, function(t) {
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

      t.equals(docs.length, numDocs, "correct number of docs in _all_docs")
      t.equals(changes.length, numDocs, "correct number of docs in _changes")
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

function verifyChanges(db, cb) {
  var db_one_ids = {}, db_one_dup_ids = [], db_one_seqs = {}, db_one_dup_seqs = [];

  db("_changes", function(err, data) {
    db("_all_docs", function(err, view){
      data.results.forEach(function(r){
        if (db_one_ids[r.id]) {
          db_one_dup_ids.push(r.id)
        }
        db_one_ids[r.id] = true

        if (db_one_seqs[r.seq]) {
          db_one_dup_seqs.push(r.seq)
        }
        db_one_seqs[r.seq] = true
      })
      cb(db_one_ids, db_one_dup_ids, db_one_seqs, db_one_dup_seqs)
    })
  })
}


test("verify cbl changes", function(t){
  verifyChanges(coax([server, dbs[0]]), function(db_one_ids, db_one_dup_ids, db_one_seqs,db_one_dup_seqs) {
    var one_ids_list = Object.keys(db_one_ids), db_one_seqs_list = Object.keys(db_one_seqs)
    t.equals(one_ids_list.length, numDocs, "correct number of docs in _all_docs")
    t.equals(db_one_seqs_list.length, numDocs, "correct number of docs in _changes")
    t.equals(db_one_dup_ids.length, 0, "duplicate ids in changes "+db_one_dup_ids)
    t.equals(db_one_dup_seqs.length, 0, "duplicate seqs in changes")

    verifyChanges(coax([server, dbs[0]]), function(db_two_ids, db_two_dup_ids, db_two_seqs,db_two_dup_seqs) {
      var db_two_idslist = Object.keys(db_two_ids), db_two_seqs_list = Object.keys(db_two_seqs)

      t.equals(db_two_idslist.length, numDocs, "correct number of docs in _all_docs")
      t.equals(db_two_seqs_list.length, numDocs, "correct number of docs in _changes")
      t.equals(db_two_dup_ids.length, 0, "duplicate ids in changes")
      t.equals(db_two_dup_seqs.length, 0, "duplicate seqs in changes")

      var missing_from_one =[], missing_from_two=[]
      for (var i = db_two_idslist.length - 1; i >= 0; i--) {
        if (!db_one_ids[db_two_idslist[i]]) {
          missing_from_one.push(db_two_idslist[i])
        }
      };
      for (var i = one_ids_list.length - 1; i >= 0; i--) {
        if (!db_two_ids[one_ids_list[i]]) {
          missing_from_two.push(one_ids_list[i])
        }
      };
      t.equals(0, missing_from_one.length, "missing changes in one "+missing_from_one.join())
      t.equals(0, missing_from_two.length, "missing changes in two"+missing_from_two.join())
      t.end()
    })
  })
})

test("cleanup cb bucket", function(t){
    if (config.DbUrl.indexOf("http") > -1){
    coax.post([config.DbUrl + "/pools/default/buckets/" + config.DbBucket + "/controller/doFlush"],
	    {"auth":{"passwordCredentials":{"username":"Administrator", "password":"password"}}}, function (err, js){
	      t.false(err, "flush cb bucket")
	    })
	}
    t.end()
})

test("done", function(t){
  common.cleanup(t, function(json){
    sg.kill()
    t.end()
  })
})

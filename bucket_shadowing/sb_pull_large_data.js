var launcher = require("../lib/launcher"),
  coax = require("coax"),
  async = require("async"),
  common = require("../tests/common"),
  util =  require("util"),
  test = require("tap").test,
  test_time = process.env.TAP_TIMEOUT || 60,
  test_conf = {timeout: test_time * 1000},
  couchbase = require('couchbase');

var server, sg, gateway,
pulldb = "pull_db",
bucketNames = ["app-bucket", "shadow-bucket"],
app_bucket = new couchbase.Connection({host: 'localhost:8091', bucket: bucketNames[0]}),
shadow_bucket = new couchbase.Connection({host: 'localhost:8091', bucket: bucketNames[1]});

var sgShadowBucketDb = "http://localhost:4985/db"  
var urlCB = "http://localhost:8091"  
if (config.provides=="android") sgShadowBucketDb = sgShadowBucketDb.replace("localhost", "10.0.2.2");
var timeStamps = [];
var data = [];

var numDocs= 1;  //???? parseInt(config.numDocs) || 100;
var timeoutShadowing = 2000;
var timeoutReplication = 5000;
var maxDataSize = 400; //??? 10000000; 


test("create buckets", function (t) {
    common.createShadowBuckets(t, bucketNames[0],bucketNames[1])
});

test("start test client", function(t){
  common.launchClient(t, function(_server){
    server = _server
    setTimeout(function () {
        t.end()
    }, 10000) 
  })
})

test("start sync_gateway", function(t){
  common.launchSGShadowing(t, function(_sg){
    sg  = _sg
    gateway = sg.url
    t.end()
  })
})

test("create test database " + pulldb, function(t){
  common.createDBs(t, [ pulldb ])
  t.end()
})

test("Mobile client start continous replication", function(t) {
    //console.log("===== Web client to start pull replication url:" + coax([server, "_replicate"]).pax().toString(), "source:", sgShadowBucketDb, ">>  target:", pulldb)
    coax.post([server, "_replicate"], {
        source : sgShadowBucketDb,
        target : pulldb,
        continuous : true
    }, function(err, info) {
        t.false(err, "create continous replication. error: " + JSON.stringify(err))
        t.end()
    });    
});

test("Adding a document of maximum size to app-bucket and verify it is shadowed correctly", function(t) {
    var docId = "testdoc_max_size";
    data = (new Array(maxDataSize - 320 )).join("x")  //320 is the size of additional data SG craeted for the doc
    var value = {k : data};
    //console.log("===== Creating doc in app bucket.  Doc id:" + docId + " with data size of " + maxDataSize);
    app_bucket.upsert(docId, JSON.stringify( value ), function(err, result) {
        if (err) {
            throw err;
            t.end()
        } else {
            t.ok(!err, "Document " + docId + " created successfully on app_bucket")
            setTimeout(function () {
                // Check the doc is shadowed to shadow bucket successfully
                shadow_bucket.get(docId, function(err, result) {
                    if (err) {
                        throw err;
                        t.end()
                    } else {
                        t.equals(JSON.stringify(result.value.k), JSON.stringify(data), "Document " + docId + " shadowed successfully to shadow bucket - same data" )
                        setTimeout(function () {
                            // Mobile client to check the doc replicated to lite db
                            var urlReadDoc = coax([server, pulldb, docId, {attachments: true}]).pax().toString()
                            coax([server, pulldb, docId], function (err, js) {
                                if (err) {
                                    t.fail("Fail to read document " + docId + " in destination lite db. url: " + urlReadDoc + " err: " + JSON.stringify(err) )
                                    t.end()
                                } else {
                                    t.equals(JSON.stringify(js.k), JSON.stringify(data), "Document " + docId + " is replicated to lite db successfully - same data");
                                    t.end()
                                }
                            })
                        }, timeoutReplication  )
                    }
                }); 
            }, timeoutShadowing ) 
        }
    });            
});

test("Verify updating a doc with maximum size in app-bucket and check shadowing is done properly", function(t) {
    var docId = "testdoc_max_size";
    data = (new Array(maxDataSize - 320 )).join("y")  //320 is the size of additional data SG craeted for the doc
    var value = {k : data};
    //console.log("===== Updating doc in app bucket.  Doc id:" + docId + " with data size of " + maxDataSize);
    app_bucket.upsert(docId, JSON.stringify( value ), function(err, result) {
        if (err) {
            throw err;
            t.end()
        } else {
            t.ok(!err, "Document " + docId + " created successfully on app_bucket")
            setTimeout(function () {
                // Check the doc is shadowed to shadow bucket successfully
                shadow_bucket.get(docId, function(err, result) {
                    if (err) {
                        throw err;
                        t.end()
                    } else {
                        t.equals(JSON.stringify(result.value.k), JSON.stringify(data), "Document " + docId + " shadowed successfully to shadow bucket - same data" )
                        setTimeout(function () {
                            // Mobile client to check the doc replicated to lite db
                            var urlReadDoc = coax([server, pulldb, docId, {attachments: true}]).pax().toString()
                            coax([server, pulldb, docId], function (err, js) {
                                if (err) {
                                    t.fail("Fail to read document " + docId + " in destination lite db. url: " + urlReadDoc + " err: " + JSON.stringify(err) )
                                    t.end()
                                } else {
                                    t.equals(JSON.stringify(js.k), JSON.stringify(data), "Document " + docId + " is replicated to lite db successfully - same data");
                                    t.end()
                                }
                            })
                        }, timeoutReplication  )
                    }
                }); 
            }, timeoutShadowing ) 
        }
    });            
});

test("Verify removing a doc with maximum size in app-bucket and check the doc is no longer accessible from lite db", function(t) {
  var docId = "testdoc_max_size";
  app_bucket.remove(docId, function(err, result) {
      if (err) {
          throw err;
          t.end()
      } else {
          t.ok(!err, "Document " + docId + " created successfully on app_bucket")
          setTimeout(function () {
              // Mobile client to check the doc not accessible from the lite db
              var urlReadDoc = coax([server, pulldb, docId, {attachments: true}]).pax().toString()
              coax([server, pulldb, docId], function (err, result) {
                  if (err) {
                      t.equals(JSON.stringify(err.status), "404", "expected status code for doc " + docId + " should be 404.  return: " + JSON.stringify(err))
                      t.end()
                  } else {
                      t.fail("Error: Doc " + docId + " was removed from the app bucket but still accessible from lite db.  result: " + JSON.stringify(result))
                      t.end()
                  }
              })
          }, timeoutReplication)
      }
  });            
});


test("delete buckets", function (t) {
    common.deleteShadowBuckets(t, bucketNames[0],bucketNames[1])
});

test("done", function(t){
  common.cleanup(t, function(json){
    sg.kill()
    app_bucket.shutdown();
    shadow_bucket.shutdown();
    t.end()
  })
})
 



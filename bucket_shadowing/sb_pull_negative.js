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

test("Adding an over-sized document to app-bucket and verify it is not shadowed", function(t) {
    var docId = "testdoc_over_max_size";
    var data = (new Array(maxDataSize - 319 )).join("x")  //320 is the size of additional data SG craeted for the doc
    var value = {k : data};
    app_bucket.upsert(docId, JSON.stringify( value ), function(err, result) {
        if (err) {
            throw err;
            t.end()
        } else {
            t.ok(!err, "Document " + docId + " created successfully on app_bucket")
            setTimeout(function () {
                // Check the doc is created in app_bucket successfully
                app_bucket.get(docId, function(error, result) {
                    if (error) {
                        t.fail(error, "over-sized doc was not created in app-bucket.  error:" + JSON.stringify(error))
                        t.end()
                    } else {
                        t.ok(!error, "over-sized doc was created in app-bucket.  error:" + JSON.stringify(error))
                        // Check the doc is not shadowed to shadow bucket 
                        shadow_bucket.get(docId, function(err, result) {
                            t.ok(!err, "over-sized doc was not supposed to shadowed to shadow-bucket.  error:" + JSON.stringify(err))
                            t.end()
                        }); 
                    }    
                });    
            }, timeoutShadowing ) 
        }
    });            
});

test("Adding an empty document to app-bucket and verify it is not shadowed", function(t) {
    var docId = "testdoc_empty";
    var value = "";
    app_bucket.upsert(docId, value, function(err, result) {
        if (err) {
            throw err;
            t.end()
        } else {
            t.ok(!err, "Document " + docId + " created successfully on app_bucket")
            setTimeout(function () {
                // Check the doc is created in app_bucket successfully
                app_bucket.get(docId, function(error, result) {
                    if (error) {
                        t.fail(error, "empty doc was not created in app-bucket.  error:" + JSON.stringify(error))
                        t.end()
                    } else {
                        t.ok(!error, "empty doc was created in app-bucket.  error:" + JSON.stringify(error))
                        // Check the doc is not shadowed to shadow bucket 
                        shadow_bucket.get(docId, function(err, result) {
                            t.ok(err, "empty doc was not supposed to shadowed to shadow-bucket.  error:" + JSON.stringify(err))
                            t.end()
                        }); 
                    }    
                });    
            }, timeoutShadowing ) 
        }
    });            
});

test("Adding an non-json document to app-bucket and verify it is not shadowed", function(t) {
    var docId = "testdoc_non_json";
    var value = "aaaa";
    app_bucket.upsert(docId, value, function(err, result) {
        if (err) {
            throw err;
            t.end()
        } else {
            t.ok(!err, "Document " + docId + " created successfully on app_bucket")
            setTimeout(function () {
                // Check the doc is created in app_bucket successfully
                app_bucket.get(docId, function(error, result) {
                    if (error) {
                        t.fail(error, "Non-json doc was not created in app-bucket.  error:" + JSON.stringify(error))
                        t.end()
                    } else {
                        t.ok(!error, "Non-json doc was created in app-bucket.  error:" + JSON.stringify(error))
                        // Check the doc is not shadowed to shadow bucket 
                        shadow_bucket.get(docId, function(err, result) {
                            t.ok(err, "Non-json doc was not supposed to shadowed to shadow-bucket.  error:" + JSON.stringify(err))
                            t.end()
                        }); 
                    }    
                });    
            }, timeoutShadowing ) 
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
 



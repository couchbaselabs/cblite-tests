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

var numDocs= parseInt(config.numDocs) || 100;
var timeoutShadowing = 2000;
var timeoutReplication = 5000;


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

test("Web client create docs in app-bucket and check the doc is shadowed to shadow bucket and replicated to lite db successfully", function(t) {
    async.times(numDocs, function(i, cb){
        var docId = "testdoc_" + i;
        data[i] = Math.random() + "_" + i;
        timeStamps[i] = new Date();
        var value = {_id : docId,
                    data: data[i],
                    at: timeStamps[i]};
        //console.log("===== Creating doc in app bucket.  Doc id=" + docId + " value=" + JSON.stringify( value ));
        app_bucket.upsert(docId, JSON.stringify( value ), function(err, result) {
            if (err) {
                throw err;
                cb(err, result)
            } else {
                t.ok(!err, "Document " + docId + " created successfully on app_bucket")
                setTimeout(function () {
                    // Check the doc is shadowed to shadow bucket successfully
                    shadow_bucket.get(docId, function(err, result) {
                        if (err) {
                            throw err;
                            cb(err, result)
                        } else {
                            t.equals(JSON.stringify(result.value.at), JSON.stringify(timeStamps[i]), "Document " + docId + " shadowed successfully to shadow bucket - same timestamp");
                            t.equals(JSON.stringify(result.value.data), JSON.stringify(data[i]), "Document " + docId + " shadowed successfully to shadow bucket - same data");
                            setTimeout(function () {
                                // Mobile client to check the doc replicated to lite db
                                var urlReadDoc = coax([server, pulldb, docId, {attachments: true}]).pax().toString()
                                coax([server, pulldb, docId], function (err, js) {
                                    if (err) {
                                        t.fail("Fail to read document " + docId + " in destination lite db. url: " + urlReadDoc + " err: " + JSON.stringify(err))
                                        cb(err, result)
                                    } else {
                                        t.equals(JSON.stringify(js.at), JSON.stringify(timeStamps[i]), "Document " + docId + " is replicated to lite db successfully  - same timestamp");
                                        t.equals(JSON.stringify(js.data), JSON.stringify(data[i]), "Document " + docId + " is replicated to lite db successfully - same data");
                                        cb(err, result)
                                    }
                                })
                            }, timeoutReplication)
                        }
                    }); 
                }, timeoutShadowing) 
            }
        });            
    }, function(err, result){
        t.end()
    })  
});


test("Web client updating docs with large data in app-bucket and check the doc is shadowed to shadow bucket and replicated to lite db successfully", function(t) {
    async.times(numDocs, function(i, cb){
        var docId = "testdoc_" + i;
        data[i] = "2222";
        timeStamps[i] = new Date();
        var value = {_id : docId,
                    data: data[i],
                    at: timeStamps[i]};
        //console.log("===== Updating doc " + docId + " value=" + JSON.stringify( value ));
        app_bucket.upsert(docId, JSON.stringify( value ), function(err, result) {
            if (err) {
                throw err;
                cb(err, result)
            } else {
                t.ok(!err, "Document " + docId + " updated successfully on app_bucket")
                setTimeout(function () {
                    // Check the doc is shadowed to shadow bucket successfully
                    shadow_bucket.get(docId, function(err, result) {
                        if (err) {
                            throw err;
                            cb(err, result)
                        } else {
                            t.equals(JSON.stringify(result.value.at), JSON.stringify(timeStamps[i]), "Document " + docId + " shadowed successfully to shadow bucket - same timestamp");
                            t.equals(JSON.stringify(result.value.data), JSON.stringify(data[i]), "Document " + docId + " shadowed successfully to shadow bucket - same data");
                            setTimeout(function () {
                                // Mobile client to check the doc replicated to lite db
                                var urlReadDoc = coax([server, pulldb, docId, {attachments: true}]).pax().toString()
                                coax([server, pulldb, docId], function (err, js) {
                                    if (err) {
                                        t.fail("Fail to read document " + docId + " in destination lite db. url: " + urlReadDoc + " err: " + JSON.stringify(err))
                                        cb(err, result)
                                    } else {
                                        t.equals(JSON.stringify(js.at), JSON.stringify(timeStamps[i]), "Document " + docId + " is replicated to lite db successfully  - same timestamp");
                                        t.equals(JSON.stringify(js.data), JSON.stringify(data[i]), "Document " + docId + " is replicated to lite db successfully - same data");
                                        cb(err, result)
                                    }
                                })
                            }, timeoutReplication)
                        }
                    }); 
                }, timeoutShadowing) 
            }
        });            
    }, function(err, result){
        t.end()
    })  
});

test("Web client remove docs in app-bucket and check the doc is no longer accessible from lite db successfully", function(t) {
    async.times(numDocs, function(i, cb){
        var docId = "testdoc_" + i;
        //console.log("===== Removing doc " + docId);
        app_bucket.remove(docId, function(err, result) {
            if (err) {
                throw err;
                cb(err, result)
            } else {
                t.ok(!err, "Document " + docId + " removed successfully from app_bucket")
                setTimeout(function () {
                    // Mobile client to check the doc replicated to lite db
                    var urlReadDoc = coax([server, pulldb, docId, {attachments: true}]).pax().toString()
                    coax([server, pulldb, docId], function (err, result) {
                        if (err) {
                            t.equals(JSON.stringify(err.status), "404", "expected status code for doc " + docId + " should be 404.  return: " + JSON.stringify(err))
                            cb(err, result)
                        } else {
                            t.fail("Error: Doc " + docId + " was removed from the app bucket but still accessible from lite db.  result: " + JSON.stringify(result))
                            cb(err, result)
                        }
                    })
                }, timeoutReplication)
            }
        });            
    }, function(err, result){
        t.end()
    })  
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
 




//This file has the test cases to verify the following order of events
//1. CBS already has a app bucket, using shadowing it copies over all contents to Sync Gateway bucket
//   Load documents into app_bucket before starting sync_gateway.  
//   Start sync_gateway 
//   Verify the old documents got shadowed to the shadow_bucket as soon as sync_gateway started
//
//2. Verfiy kill and restart of sync_gateway does not affect shadowing 
//
//3. Delete shadow_bucket while sync_gateway is running. Verify that sync_gateway handle it gracefully 
//
//
//Not testing flash or delete of app_bucket and shadow_bucket


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
pushdb = "push_db",
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

test("create test database " + pulldb + " and " + pulldb, function(t){
  common.createDBs(t, [ pulldb, pushdb ])
  t.end()
})

test("Web client create docs in app-bucket before sync_gateway is started", function(t) {
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
                t.fail("Fail to create document " + docId + " in app_bucket. err: " + JSON.stringify(err))
                throw err;
                cb(err, result)
            } else {
                t.ok(!err, "Document " + docId + " created successfully on app_bucket")
                cb(err, result)
            }
        });            
    }, function(err, result){
        t.end()
    })  
});

test("start sync_gateway when app_bucket has document loaded already", function(t){
    setTimeout(function () {
        common.launchSGShadowing(t, function(_sg){
            sg  = _sg
            gateway = sg.url
            t.end()
        })
    }, timeoutShadowing)  
})

test("Mobile client start continous pull replication", function(t) {
    setTimeout(function () {
        //console.log("===== Web client to start pull replication url:" + coax([server, "_replicate"]).pax().toString(), "source:", sgShadowBucketDb, ">>  target:", pulldb)
        coax.post([server, "_replicate"], {
            source : sgShadowBucketDb,
            target : pulldb,
            continuous : true
        }, function(err, info) {
            t.false(err, "create continous replication. error: " + JSON.stringify(err))
            t.end()
        });
    }, timeoutShadowing)  
});

test("Mobile client start continous push replication", function(t) {
    coax.post([server, "_replicate"], {
        source : pushdb,
        target : sgShadowBucketDb,
        continuous : true
    }, function(err, info) {
        t.false(err, "error starting continous push replication. error:" + JSON.stringify(err))
        t.end();
    });
});

test("Verify the documents in app_bucket are shadowed to shadow_bucket and lite db", function(t) {
    setTimeout(function () {
        async.times(numDocs, function(i, cb){
            var docId = "testdoc_" + i;
            // Check the doc is shadowed to shadow bucket successfully
            shadow_bucket.get(docId, function(err, result) {
                if (err) {
                    t.fail("Fail to get document " + docId + " in shadow_bucket. err: " + JSON.stringify(err))
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
        }, function(err, result){
            t.end()
        }) 
    }, timeoutShadowing)  
}); 

test("kill and re-start sync_gateway", function(t){
    sg.kill()
    setTimeout(function () {
        common.launchSGShadowing(t, function(_sg){
            sg  = _sg
            gateway = sg.url
            t.end()
        })
    }, timeoutShadowing)  
})

test("Web client add one more doc to app-bucket and verify that bucket shadowing still working", function(t) {
    var docId = "testdoc_add_to_app_bucket_after_restart_sg";
    var data = "222222";
    var value = {_id : docId,
                data: data,
                at: new Date()};
    app_bucket.upsert(docId, JSON.stringify( value ), function(err, result) {
        if (err) {
            t.fail("Fail to create document " + docId + " in app_bucket. err: " + JSON.stringify(err))
            throw err;
            t.end()
        } else {
            t.ok(!err, "Document " + docId + " created successfully on app_bucket")
            setTimeout(function () {
                // Check the doc is shadowed to shadow bucket successfully
                shadow_bucket.get(docId, function(err, result) {
                    if (err) {
                        t.fail("Fail to get document " + docId + " in shadow_bucket. err: " + JSON.stringify(err))
                        throw err;
                        t.end()
                    } else {
                        t.equals(JSON.stringify(result.value.data), JSON.stringify(data), "Document " + docId + " shadowed successfully to shadow bucket - same data");
                        setTimeout(function () {
                            // Mobile client to check the doc replicated to lite db
                            var urlReadDoc = coax([server, pulldb, docId, {attachments: true}]).pax().toString()
                            coax([server, pulldb, docId], function (err, js) {
                                if (err) {
                                    t.fail("Fail to read document " + docId + " in destination lite db. url: " + urlReadDoc + " err: " + JSON.stringify(err))
                                    t.end()
                                } else {
                                    t.equals(JSON.stringify(js.data), JSON.stringify(data), "Document " + docId + " is replicated to lite db successfully - same data");
                                    t.end()
                                }
                            })
                        }, timeoutReplication)
                    }
                }); 
    }, timeoutShadowing)  
        }
    });            
});

test("Mobile client push one doc to shadow-bucket and verify that bucket shadowing still working", function(t){
    var docId = "testdoc_push_after_restart_sg";
    var value_json = {_id : docId,
                data: "0000",   
                at: new Date()};
    coax.put([server,pushdb, docId], value_json, function(err, ok){
        if (err){
            t.false(err, "error loading doc.  url: " + coax.put([server, pushdb, docId]).pax().toString() +" err: " + JSON.stringify(err));
            t.end()
        } else {
            t.equals(docId, ok.id, "Doc " + docId + " created");
            setTimeout(function () {
                app_bucket.get(docId, function(err, result) {
                    if (err) {
                        t.fail("Fail to get document " + docId + " in app_bucket. err: " + JSON.stringify(err))
                        throw err;
                        t.end()
                    } else {
                        t.ok(true,"Document " + docId + " is shadowed to app_bucket successfully")
                        t.end()
                    }
                })
            }, timeoutShadowing); 
        } 
    })       
})

test("delete app_bucket while shadow bucket is going on ", function (t) {
    var post_data = 'STR';
    var options = {
      host : "localhost",
      port : 8091,
      path: "/pools/default/buckets/" + bucketNames[0],
      auth : "Administrator:password",
      method: 'DELETE',
      headers: {
          'Content-Type': 'text/html'
      }
    };
    common.http_post_api(t, post_data, options, 200, function (callback) {
        //t.end();
    });
});

test("Verify the documents in shadow_bucket is still there and still accessible from the lite db ", function(t) {
    setTimeout(function () {
        async.times(numDocs, function(i, cb){
            var docId = "testdoc_" + i;
            // Check the doc is shadowed to shadow bucket successfully
            shadow_bucket.get(docId, function(err, result) {
                if (err) {
                    t.fail("Fail to get document " + docId + " in shadow_bucket. err: " + JSON.stringify(err))
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
        }, function(err, result){
            t.end()
        }) 
    }, timeoutShadowing)  
});


test("With app_bucket down, push one doc from lite db to shadow_bucket.  Verify sync_gateway handle it correctly.", function(t){
    var docId = "testdoc_push_with_app_bucket_off";
    var value_json = {_id : docId,
                data: "11111",   
                at: new Date()};
    coax.put([server,pushdb, docId], value_json, function(err, ok){
        if (err){
            t.false(err, "error loading doc.  url: " + coax.put([server, pushdb, docId]).pax().toString() +" err: " + JSON.stringify(err));
            t.end()
        } else {
            t.equals(docId, ok.id, "Doc " + docId + " created");
            setTimeout(function () {
                async.times(numDocs, function(i, cb){
                    shadow_bucket.get(docId, function(err, result) {
                        if (err) {
                            t.fail("Fail to get document " + docId + " in shadow_bucket. err: " + JSON.stringify(err))
                            throw err;
                            cb(err, result)
                        } else {
                            t.ok(true,"Document " + docId + " is replicated to shadow_bucket successfully")
                            cb(err, result)
                        }
                    })
                }, function(err, result){
                    t.end()
                })  
            }, timeoutShadowing); 
        } 
    })       
})

test("delete shadow_bucket while sync_gateway is running. Make sure sync_gateway handle it gracefully ", function (t) {
    var post_data = 'STR';
    var options = {
      host : "localhost",
      port : 8091,
      path: "/pools/default/buckets/" + bucketNames[1],
      auth : "Administrator:password",
      method: 'DELETE',
      headers: {
          'Content-Type': 'text/html'
      }
    };
    common.http_post_api(t, post_data, options, 200, function (callback) {
    });
});

test("done", function(t){
  common.cleanup(t, function(json){
    sg.kill()
    app_bucket.shutdown();
    shadow_bucket.shutdown();
    t.end()
  })
})
 



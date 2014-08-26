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
pushdb = "push_db",
bucketNames = ["app-bucket", "shadow-bucket"],
app_bucket = new couchbase.Connection({host: 'localhost:8091', bucket: bucketNames[0]}),
shadow_bucket = new couchbase.Connection({host: 'localhost:8091', bucket: bucketNames[1]});

var sgShadowBucketDb = "http://localhost:4985/db" 
var urlCB = "http://localhost:8091" 
if (config.provides=="android") sgShadowBucketDb = sgShadowBucketDb.replace("localhost", "10.0.2.2");

var timeoutShadowing = 2000;
var timeoutReplication = 5000;
var sg_total_rows = 0;
var sg_sequence_number = 0;

var docId = "testdoc";
var value_data = Math.random().toString(5).substring(4);
var value_json = {_id : docId,
            data: value_data,   
            at: new Date()};
var value = JSON.stringify( value_json );

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

test("start syncgateway", function(t){
  common.launchSGShadowing(t, function(_sg){
    sg  = _sg
    gateway = sg.url
    t.end()
  })
})

test("create test database " + pushdb, function(t){
  common.createDBs(t, [ pushdb ])
  t.end()
})

test("Load one doc into lite pushdb", function(t){
  setTimeout(function () {
    coax.put([server,pushdb, docId], value_json, function(err, ok){
        if (err){
            t.false(err, "error loading doc.  url: " + coax.put([server, pushdb, docId]).pax().toString() +" err: " + JSON.stringify(err));
        } else {
            t.equals(docId, ok.id, "Doc " + docId + " created");
            t.end();
        }
    });
  }, timeoutReplication);  
})

test("Mobile client start continous push replication", function(t) {
    console.log(coax([server, "_replicate"]).pax().toString(), "source:", pushdb, ">>  target:", sgShadowBucketDb);
    coax.post([server, "_replicate"], {
        source : pushdb,
        target : sgShadowBucketDb,
        continuous : true
    }, function(err, info) {
        t.false(err, "error starting continous push replication. error:" + JSON.stringify(err))
        t.end();
    });
});

test("Verify that the doc is replicated to sync_gateway", test_conf, function(t) {
    setTimeout(function () {
        coax([sgShadowBucketDb, "_all_docs"],function(err, allDocs){
            t.false(err, "sg database exists");
            t.ok(allDocs, "got _all_docs repsonse");
            t.equals(allDocs.update_seq, 2, "sg sequence number correct")
            t.end();
        });
    }, timeoutReplication);
});

test("Verify that the doc is shadowed to app-bucket", test_conf, function(t) {
    setTimeout(function () {
        app_bucket.get(docId, function(err, result) {
            if (err) {
                t.end();
                throw err;
            } else {
                t.equals(JSON.stringify(result.value.at), JSON.stringify(value_json.at), "Document shadowed successfully to app bucket - same timestamp");
                t.equals(JSON.stringify(result.value.data), JSON.stringify(value_json.data), "Document shadowed successfully to app bucket - same data");
                t.end();
            }
        });
    }, timeoutReplication);
});

test("Update the doc in lite pushdb", function(t){
    // get the document revision and update the revision
    coax([server, pushdb, docId], function (err, doc) {
        if (err || (!doc) || doc == undefined) {
            t.fail("unable to get doc rev for url:" + coax([server, pushdb, docid]).pax().toString() + ", err:" + err + ", json:" + doc);
            t.end();
        } else {
            // Change the date and data of the doc
            doc.data = "222222"
            doc.at = new Date()
            value_json.data = doc.data
            value_json.at = doc.at
            // put updated doc
            coax.put([server, pushdb, docId], doc, function(err, ok){
                if (err){
                    t.false(err, "error updating doc.  url: " + coax.put([server,pushdb, docId]).pax().toString() +" err: " + JSON.stringify(err));
                } else {
                    t.equals(docId, ok.id, "Doc " + docId + " updated");
                    t.end();
                }
            })
        }
    })
})

test("Verify the updated document is shadowed to app-bucket", test_conf, function(t) {
    setTimeout(function () {
        app_bucket.get(docId, function(err, result) {
            if (err) {
                t.end();
                throw err;
            } else {
                t.equals(JSON.stringify(result.value.at), JSON.stringify(value_json.at), "Document shadowed successfully to app bucket - same timestamp");
                t.equals(JSON.stringify(result.value.data), JSON.stringify(value_json.data), "Document shadowed successfully to app bucket - same data");
                t.end();
            }
        });
    }, timeoutReplication);
});

test("Mobile client remove the doc in lite and verify the change is shadowed to app-bucke", function(t) {
    // get the document revision and delete the revision
    coax([server, pushdb, docId], function (err, doc) {
        if (err || (!doc) || doc == undefined) {
            t.fail("unable to get doc rev for url:" + coax([server, pushdb, docid]).pax().toString() + ", err:" + err + ", json:" + doc);
            t.end();
        } else {
            //delete doc
            coax.del([server, pushdb, docId, {rev : doc._rev}], function (err, json) {
                t.equals(json.ok, true, "doc is deleted")
                setTimeout(function () {
                    app_bucket.get(docId, function(err, result) {
                        t.equals(JSON.stringify(err.message), "\"The key does not exist on the server\"", "The deleted document is removed at app bucket")
                        t.end()
                    });
                }, timeoutReplication);
            })
        }
    })
});

test("Re-load the deleted doc into lite pushdb", function(t){
    coax.put([server,pushdb, docId], value_json, function(err, ok){
        if (err){
            t.false(err, "error loading doc.  url: " + coax.put([server,pushdb, docId]).pax().toString() +" err: " + JSON.stringify(err));
        } else {
            t.equals(docId, ok.id, "Doc " + docId + " created");
            t.end();
        }
    });
})

test("Verify that the doc is shadowed to app-bucket", test_conf, function(t) {
    setTimeout(function () {
        app_bucket.get(docId, function(err, result) {
            if (err) {
                t.end();
                throw err;
            } else {
                t.equals(JSON.stringify(result.value.at), JSON.stringify(value_json.at), "Document shadowed successfully to app bucket - same timestamp");
                t.equals(JSON.stringify(result.value.data), JSON.stringify(value_json.data), "Document shadowed successfully to app bucket - same data");
                t.end();
            }
        });
    }, timeoutReplication);
});


test("done", function(t){
  common.cleanup(t, function(json){
    sg.kill()
    app_bucket.shutdown();
    shadow_bucket.shutdown();
    t.end()
  })
})

test("delete buckets", function (t) {
    common.deleteShadowBuckets(t, bucketNames[0],bucketNames[1])
});

 

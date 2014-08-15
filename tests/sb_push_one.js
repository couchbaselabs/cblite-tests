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
pushdbs = ["push_db"],
pulldbs = ["pull_db"],
bucketNames = ["app-bucket", "shadow-bucket"];
app_bucket = new couchbase.Connection({host: 'localhost:8091', bucket: bucketNames[0]}),
shadow_bucket = new couchbase.Connection({host: 'localhost:8091', bucket: bucketNames[1]}),
keySerial = 0;

var sgShadowBucketDb = "http://localhost:4985/db" 
var urlCB = "http://localhost:8091" 
if (config.provides=="android") sgShadowBucketDb = sgShadowBucketDb.replace("localhost", "10.0.2.2");

var numDocs= 1;
var timeoutShadowing = 2000 * numDocs;
var timeoutReplication = 5000 * numDocs;
var keySerial = 0;
var sg_total_rows = 0;
var sg_sequence_number = 0;

genKey = function(prefix) {
    var ret = prefix + keySerial;
    keySerial++;
    return ret;
};

var docId = genKey('test');
var value_data = Math.random().toString(5).substring(4);
var value_json = {_id : docId,
            data: value_data,   
            at: new Date()};
var value = JSON.stringify( value_json );


 
// start client endpoint
test("start test client", function(t){
    common.launchClient(t, function(_server){
        server = _server
        t.end()
    })
})

// // start sync gateway
// test("start syncgateway", function(t){
//   common.launchSG(t, function(_sg){
//     sg  = _sg
//     gateway = sg.url
//     t.end()
//   })
// })

// create all dbs
test("Create test lite db - " + pushdbs, function(t){
    common.createDBs(t, pushdbs)
})

test("Get sequence number of total_rows from sync_gateway", test_conf, function(t) {
    setTimeout(function () {
        coax([sgShadowBucketDb, "_all_docs"],function(err, allDocs){
            t.false(err, "sg database exists");
            sg_total_rows = allDocs.total_rows;
            sg_sequence_number = allDocs.update_seq;
            t.end();
        });
    }, timeoutReplication);
});

test("Load one doc into lite pushdb", function(t){
    coax.put([server,pushdbs[0], docId], value_json, function(err, ok){
        if (err){
            t.false(err, "error loading doc.  url: " + coax.put([server,pushdbs[0], docId]).pax().toString() +" err: " + JSON.stringify(err));
        } else {
            t.equals(docId, ok.id, "Doc " + docId + " created");
            t.end();
        }
    });
})

test("Mobile client start continous push replication", function(t) {
    console.log(coax([server, "_replicate"]).pax().toString(), "source:", pushdbs[0], ">>  target:", sgShadowBucketDb);
    coax.post([server, "_replicate"], {
        source : pushdbs[0],
        target : sgShadowBucketDb,
        continuous : true
    }, function(err, info) {
        t.false(err, "replication created")
        t.end();
    });
});

test("Verify that the doc is replicated to sync_gateway", test_conf, function(t) {
    setTimeout(function () {
        coax([sgShadowBucketDb, "_all_docs"],function(err, allDocs){
            t.false(err, "sg database exists");
            t.ok(allDocs, "got _all_docs repsonse");
            t.equals(allDocs.update_seq, sg_sequence_number + numDocs + 1, "sg sequence number correct")
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
    coax([server, pushdbs[0], docId], function (err, doc) {
        if (err || (!doc) || doc == undefined) {
            t.fail("unable to get doc rev for url:" + coax([server, pushdbs[0], docid]).pax().toString() + ", err:" + err + ", json:" + doc);
            t.end();
        } else {
            // Change the date and data of the doc
            doc.data = "222222"
            doc.at = new Date()
            value_json.data = doc.data
            value_json.at = doc.at
            // put updated doc
            coax.put([server, pushdbs[0], docId], doc, function(err, ok){
                if (err){
                    t.false(err, "error updating doc.  url: " + coax.put([server,pushdbs[0], docId]).pax().toString() +" err: " + JSON.stringify(err));
                } else {
                    t.equals(docId, ok.id, "Doc " + docId + " updated");
                    t.end();
                }
            })
        }
    })
})

test("Verify the change is shadowed to app-bucket", test_conf, function(t) {
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
    coax([server, pushdbs[0], docId], function (err, doc) {
        if (err || (!doc) || doc == undefined) {
            t.fail("unable to get doc rev for url:" + coax([server, pushdbs[0], docid]).pax().toString() + ", err:" + err + ", json:" + doc);
            t.end();
        } else {
            //delete doc
            coax.del([server, pushdbs[0], docId, {rev : doc._rev}], function (err, json) {
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
    coax.put([server,pushdbs[0], docId], value_json, function(err, ok){
        if (err){
            t.false(err, "error loading doc.  url: " + coax.put([server,pushdbs[0], docId]).pax().toString() +" err: " + JSON.stringify(err));
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
    app_bucket.shutdown();
    shadow_bucket.shutdown();
    //sg.kill()
    t.end()
  })
})

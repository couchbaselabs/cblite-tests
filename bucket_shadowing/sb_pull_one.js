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
//cluster = new couchbase.Cluster('http://localhost:8091/');
//bucket = cluster.openBucket('default'),
bucketNames = ["app-bucket", "shadow-bucket"];
app_bucket = new couchbase.Connection({host: 'localhost:8091', bucket: bucketNames[0]}),
shadow_bucket = new couchbase.Connection({host: 'localhost:8091', bucket: bucketNames[1]}),
keySerial = 0;

var sgShadowBucketDb = "http://localhost:4985/db"  //????
var urlCB = "http://localhost:8091"  //????
if (config.provides=="android") sgShadowBucketDb = sgShadowBucketDb.replace("localhost", "10.0.2.2");

var numDocs= 1;  //?????  parseInt(config.numDocs) || 100;
var timeoutShadowing = 2000 * numDocs;
var timeoutReplication = 4000 * numDocs;
var keySerial = 0;

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

test("create buckets",
	function(t) {
		var options = {
			host : "localhost",
			port : 8091,
			path : '/pools/default/buckets',
			method : 'POST',
			auth : "Administrator:password",
			headers : {
				'Content-Type' : 'application/x-www-form-urlencoded',
			}
		};
		
		var post_data0 = "name="
			+ bucketNames[0]
			+ "&parallelDBAndViewCompaction=false&autoCompactionDefined=false&threadsNumber=3&replicaIndex=0&replicaNumber=1&saslPassword=&authType=sasl&ramQuotaMB=200&bucketType=membase&flushEnabled=1";
		 var post_data1 = "name="
			+ bucketNames[1]
			+ "&parallelDBAndViewCompaction=false&autoCompactionDefined=false&threadsNumber=3&replicaIndex=0&replicaNumber=1&saslPassword=&authType=sasl&ramQuotaMB=200&bucketType=membase&flushEnabled=1";
		 
		 common.http_post_api(t, post_data0, options, "OK", function(callback) {
		 })
		    common.http_post_api(t, post_data1, options, "OK", function(callback) {
			t.end();
		    })	
		//})
	})
	
	



// start client endpoint
test("start test client", function(t){
  common.launchClient(t, function(_server){
    server = _server
    setTimeout(function () {
    t.end()
  }, 10000) 
  })
})

	// start sync gateway
test("start syncgateway", function(t){
  common.launchSGShadowing(t, function(_sg){
    sg  = _sg
    gateway = sg.url
    
    t.end()
    
  })
})

// create all dbs
test("create test databases" + pushdbs.concat(pulldbs), function(t){
  common.createDBs(t, pushdbs.concat(pulldbs))
})
    
test("Web client create docs in app app-bucket and check the doc in shadow bucket", function(t) {
    console.log("===== Creating doc in app bucket.  Doc id=" + docId + " value=" + value);
    app_bucket.upsert(docId, value, function(err, result) {
        if (err) {
            throw err;
            t.end();
        } else {
            setTimeout(function () {
                // Check the doc is shadowed to shadow bucket successfully
                shadow_bucket.get(docId, function(err, result) {
                    if (err) {
                        t.end();
                        throw err;
                    } else {
                        t.equals(JSON.stringify(result.value.at), JSON.stringify(value_json.at), "Document shadowed successfully to shadow bucket - same timestamp");
                        t.equals(JSON.stringify(result.value.data), JSON.stringify(value_json.data), "Document shadowed successfully to shadow bucket - same data");
                        t.end();
                    }
                }); 
            }, timeoutShadowing)       
        }
    });
});

test("Mobile client start continous replication", function(t) {
    console.log("===== Web client to start pull replication url:" + coax([server, "_replicate"]).pax().toString(), "source:", sgShadowBucketDb, ">>  target:", pushdbs[0])
    coax.post([server, "_replicate"], {
        source : sgShadowBucketDb,
        target : pulldbs[0],
        continuous : true
    }, function(err, info) {
        t.false(err, "replication created")
        t.end();
    });    
});

test("Mobile client check the doc replicated to lite db", function(t) {
    setTimeout(function () {
        // After replication, check the content of the file in the destination lite db
        var urlReadDoc = coax([server, pulldbs[0], docId, {attachments: true}]).pax().toString()
        console.log("===== Check the content of the file in destination lite db. url: " + urlReadDoc)
        coax([server, pulldbs[0], docId], function (e, js) {
            if (e) {
                t.fail("Fail to read doc in destination lite db. url: " + urlReadDoc + " err: " + JSON.stringify(e))
            }
            t.equals(JSON.stringify(js.at), JSON.stringify(value_json.at), "Document is replicated to lite db successfully  - same timestamp");
            t.equals(JSON.stringify(js.data), JSON.stringify(value_json.data), "Document is replicated to lite db successfully - same data");
            t.end()
        })
    }, timeoutReplication)   
});

test("Web client update the doc in app app-bucket and check the changes got shadowed to shadow bucket", function(t) {
    value_data = "2222";
    value_json = {_id : docId,
                data: value_data,   //???? Math.random().toString(5).substring(4),
                at: new Date()};
    value = JSON.stringify( value_json );
    console.log("===== Updating doc in app bucket.  Doc id=" + docId + " value=" + value);
    app_bucket.upsert(docId, value, function(err, result) {
        if (err) {
            throw err;
            t.end();
        } else {
            setTimeout(function () {
                // Check the doc is shadowed to shadow bucket
                shadow_bucket.get(docId, function(err, result) {
                    if (err) {
                        t.end();
                        throw err;
                    } else {
                        t.equals(JSON.stringify(result.value.at), JSON.stringify(value_json.at), "Document shadowed successfully to shadow bucket - same timestamp");
                        t.equals(JSON.stringify(result.value.data), JSON.stringify(value_json.data), "Document shadowed successfully to shadow bucket - same data");
                        t.end();
                    }
                }); 
            }, timeoutShadowing)        
        }
    });
});

test("Mobile client check the doc replicated to lite db", function(t) {
    setTimeout(function () {
        // After replication, check the content of the file in the destination lite db
        var urlReadDoc = coax([server, pulldbs[0], docId, {attachments: true}]).pax().toString()
        console.log("===== Check the content of the file in destination lite db. url: " + urlReadDoc)
        coax([server, pulldbs[0], docId], function (e, js) {
            if (e) {
                t.fail("Fail to read doc in destination lite db. url: " + urlReadDoc + " err: " + JSON.stringify(e))
            }
            t.equals(JSON.stringify(js.at), JSON.stringify(value_json.at), "Document is replicated to lite db successfully  - same timestamp");
            t.equals(JSON.stringify(js.data), JSON.stringify(value_json.data), "Document is replicated to lite db successfully - same data");
            t.end()
        })
    }, timeoutReplication)    
});

test("Web client remove the doc in app app-bucket and check the doc no longer accessible from lite db", function(t) {
    app_bucket.remove(docId, function(err, result) {
        if (err) {
            throw err;
            t.end();
        } else {
            setTimeout(function () {
                // After replication, check the content of the file in the destination lite db
                var urlReadDoc = coax([server, pulldbs[0], docId, {attachments: true}]).pax().toString()
                console.log("===== Check the content of the file in destination lite db. url: " + urlReadDoc)
                coax([server, pulldbs[0], docId], function (e, js) {
                    t.equals(JSON.stringify(e.status), "404", "expected status code should be 404.  return: " + JSON.stringify(e))
                    t.end()
                })
            }, timeoutReplication)   
        }
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


test("delete buckets", function (t) {
    var post_data = 'STR';
    var options0 = {
	host : "localhost",
	port : 8091,
        path: "/pools/default/buckets/" + bucketNames[0],
        auth : "Administrator:password",
        method: 'DELETE',
        headers: {
            'Content-Type': 'text/html'
        }
    };
    var options1 = {
	    	host : "localhost",
		port : 8091,
	        path: "/pools/default/buckets/" + bucketNames[1],
	        auth : "Administrator:password",
	        method: 'DELETE',
	        headers: {
	            'Content-Type': 'text/html'
	        }
	    };
    //console.log(options);
    common.http_post_api(t, post_data, options0, 200, function (callback) {
	common.http_post_api(t, post_data, options1, 200, function (callback) {
	    t.end();
	});
	});
    
});
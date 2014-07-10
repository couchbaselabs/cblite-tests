var launcher = require("../lib/launcher"),
  coax = require("coax"),
  async = require("async"),
  common = require("../tests/common"),
  util =  require("util"),
  test = require("tap").test,
  test_time = process.env.TAP_TIMEOUT || 60,
  test_conf = {timeout: test_time * 1000};

var server, sg, gateway,
  // local dbs
 dbs = ["api-test-once-push"],
 pulldbs = ["api-test-once-pull"];

var numDocs=parseInt(config.numDocs) || 100;
var timeoutReplication = 0;
if (config.provides=="android" || config.DbUrl.indexOf("http") > -1) timeoutReplication = 300 * numDocs;

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
  common.createDBs(t, dbs.concat(pulldbs))
})

test("load databases", function(t){
  common.createDBDocs(t, {numdocs : numDocs, dbs : dbs})
})

test("push replication should close connection on completion", test_conf, function(t) {
  var sgdb = sg.db.pax().toString();
  if (config.provides=="android") sgdb = sgdb.replace("localhost", "10.0.2.2");
  var lite = dbs[0];
  console.log(coax([server, "_replicate"]).pax().toString(), "source:", lite, ">>  target:", sgdb);
  coax.post([server, "_replicate"], {
    source : lite,
    target : sgdb
  }, function(err, info) {
	  setTimeout(function () {
		  t.false(err, "replication created");
		  console.log("info", info);
		  coax([sgdb, "_all_docs"],function(err, allDocs){
			  t.false(err, "sg database exists");
			  t.ok(allDocs, "got _all_docs repsonse");
			  console.log("sg doc_count", coax([sgdb, "_all_docs"]).pax().toString(), allDocs.total_rows);
			  t.equals(allDocs.total_rows, numDocs, "all docs replicated");
			  t.equals(allDocs.update_seq, numDocs + 1, "update_seq correct")
			  t.end();
		  });
	  }, timeoutReplication);
  });
});

test("pull replication should close connection on completion", test_conf, function(t) {
  var sgdb = sg.db.pax().toString()
  if (config.provides=="android") sgdb = sgdb.replace("localhost", "10.0.2.2")
  var lite = pulldbs[0]
  console.log(coax([server, "_replicate"]).pax().toString(), "source:", sgdb, ">>  target:", lite)
  coax.post([server, "_replicate"], {
    source : sgdb,
    target : lite
  }, function(err, info) {
    t.false(err, "replication created")
    setTimeout(function () {
    coax([server, lite], function(err, dbinfo){
      t.false(err, "lite database exists")
      t.ok(dbinfo, "got an info repsonse")
      console.log("lite dbinfo ", coax([server, lite]).pax().toString(), dbinfo)
      t.equals(dbinfo.doc_count, numDocs, "all docs replicated")
      t.end()
    })
    }, timeoutReplication)
  })
})

test("cleanup cb bucket", function(t){
    if (config.DbUrl.indexOf("http") > -1){
    coax.post([config.DbUrl + "/pools/default/buckets/" + config.DbBucket + "/controller/doFlush"],
	    {"auth":{"passwordCredentials":{"username":"Administrator", "password":"password"}}}, function (err, js){
	      t.false(err, "flush cb bucket")
	    },
	    setTimeout(function(){
		 t.end();
	            }, 5000));
	}else{
	    t.end();
	}
})

test("done", function(t){
  common.cleanup(t, function(json){
    sg.kill()
    t.end()
  })
})

var launcher = require("../lib/launcher"),
  coax = require("coax"),
  common = require("../tests/common"),
  conf_file = process.env.CONF_FILE || 'local',
  config = require('../config/' + conf_file);
  test = require("tap").test,
  test_time = process.env.TAP_TIMEOUT || 30,
  test_conf = {timeout: test_time * 1000};

var numDocs=(parseInt(config.numDocs) || 100)*5;

var server, sg1, sg2, sg2, sgdb,
  // local dbs
 dbs = ["mismatch-restart-one", "mismatch-restart-two"];

// start client endpoint
test("start test client", function(t){
  common.launchClient(t, function(_server){
    server = _server
    t.end()
  })
})

// start sync gateway
test("start syncgateway", function(t){
  common.launchSGWithParams(t, 9888, config.DbUrl, config.DbBucket, function(_sg1){
    sg1  = _sg1
    t.end()
  })
})

// create all dbs
test("create test databases", function(t){
  common.createDBs(t, dbs)
  sgdb1 = sg1.db.pax().toString()
})

test("load databases", test_conf, function(t){
  t.equals(numDocs/2, Math.floor(numDocs/2), "numDocs must be an even number")
  common.createDBDocs(t, {numdocs : numDocs/2, dbs : dbs, docgen : "channels"})
})

test("setup continuous push and pull from both client database", function(t) {
	if (config.provides=="android"){
		sgdb1 = sgdb1.replace("localhost", "10.0.2.2")
	  }
	common.setupPushAndPull(server, dbs[0], sgdb1, function(err, ok){
		t.false(err, 'replication one ok')
		common.setupPushAndPull(server, dbs[1], sgdb1, function(err, ok){
			t.false(err, 'replication two ok')
			t.end()
		})
	  })
	})

test("verify dbs have same number of docs", test_conf, function(t) {
  common.verifyNumDocs(t, dbs, numDocs)
})

test("kill sg", function(t){
    for (var i = 0; i < dbs.length; i++) {
    dburl = coax([server, dbs[i]]).pax().toString()
    coax(dburl, function (err, json) {
        if (err) {
            t.fail("failed to get db info from " + dburl +":" + err)
        } else {
            count = json.doc_count
            console.log("doc count in " + dburl + ": " + count)
        }
    })
}
sg1.kill()
t.end()
})

//restart sync gateway
test("restart syncgateway", function(t){
  common.launchSGWithParams(t, 9888, config.DbUrl, config.DbBucket, function(_sg1){
    sg1  = _sg1
    t.end()
  })
})

test("setup continuous push and pull from both client database", function(t) {
  common.setupPushAndPull(server, dbs[0], sgdb1, function(err, ok){
    t.false(err, 'replication one ok')
    common.setupPushAndPull(server, dbs[1], sgdb1, function(err, ok){
      t.false(err, 'replication two ok')
      t.end()
    })
  })
})

test("verify dbs have same number of docs", test_conf, function(t) {
  common.verifyNumDocs(t, dbs, numDocs)
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
    sg1.kill()
    t.end()
  })
})
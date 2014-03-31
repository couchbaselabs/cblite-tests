var launcher = require("../lib/launcher"),
  coax = require("coax"),
  async = require("async"),
  common = require("../tests/common"),
  util =  require("util"),
  conf_file = process.env.CONF_FILE || 'local',
  config = require('../config/' + conf_file),
  test = require("tap").test,
  test_time = process.env.TAP_TIMEOUT || 30,
  test_conf = {timeout: test_time * 1000};

var server, sg, gateway,
 // local dbs
 dbs = ["api-revision1"];
 // sg->local dbs
// sgdbs = ["sg-revision1"];

var numDocs=parseInt(config.numDocs) || 100;


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


// setup push/pull replication to gateway
test("set push/pull replication to gateway", function(t){

  var i = 0
  var gatewayDB = coax([gateway, config.DbBucket]).pax().toString()
  if (config.provides=="android") gatewayDB = gatewayDB.replace("localhost", "10.0.2.2")
  async.series([
    function(sgpush){

      async.mapSeries(dbs, function(db, cb){

        coax([server, "_replicate"]).post({
            source : db,
            target : gatewayDB,
            continuous : true,
          }, function(err, ok){
            t.equals(err, null,
              util.inspect({_replicate : db+" -> " + gatewayDB}))
            i++
            cb(err, ok)
          })

      }, sgpush)
    }/*,
    function(sgpull){

      async.mapSeries(dbs, function(db, cb){

        coax([server, "_replicate"]).post({
            source : gatewayDB,
            target : db,
            continuous : true,
          }, function(err, ok){

            t.equals(err, null,
              util.inspect({_replicate : db+" <- " + gatewayDB}))
            i++
            cb(err, ok)
          })

      }, sgpull)
    }*/], function(err, json){
      t.false(err, "setup push pull replication to gateway")
      t.end()
    })

})

test("load databases", test_conf, function(t){
  common.createDBDocs(t, {numdocs : numDocs, dbs : dbs})
})

test("verify replicated num-docs=" + numDocs, function(t){
  common.verifySGNumDocs(t, [sg], numDocs)
})

test("doc update on SG", test_conf, function(t){
  // start updating docs
  common.updateSGDocs(t, {dbs : [sg],
                          numrevs : 1})
})


test("doc update on SG", test_conf, function(t){
  // start updating docs
  common.updateDBDocs(t, {dbs : dbs,
                          numrevs : 1,
                          numdocs : numDocs})
})



// setup push/pull replication to gateway
test("set push/pull replication to gateway", function(t){

  var i = 0
  var gatewayDB = coax([gateway, config.DbBucket]).pax().toString()
  if (config.provides=="android") gatewayDB = gatewayDB.replace("localhost", "10.0.2.2")
  async.series([
        function(sgpull){

      async.mapSeries(dbs, function(db, cb){

        coax([server, "_replicate"]).post({
            source : gatewayDB,
            target : db,
            continuous : true,
          }, function(err, ok){

            t.equals(err, null,
              util.inspect({_replicate : db+" <- " + gatewayDB}))
            i++
            cb(err, ok)
          })

      }, sgpull)
    }],  function(err, info) {
	  setTimeout(function () {
		  t.false(err, "replication created")
		  console.log("info", info)
		  sg.db.get(function(err, dbinfo){
			  console.log(dbinfo)
			  t.false(err, "sg database exists")
			  t.ok(dbinfo, "got an info repsonse")
			  //https://github.com/couchbase/sync_gateway/issues/292
			  console.log("sg update_seq", coax(sg).pax().toString(), dbinfo)
			  t.equals(dbinfo.update_seq, numDocs*3, "all docs replicated")
			  t.end()
		  })
	  }, 10000)
  })

})
/*
test("verify local-replicated dbs changefeed", test_conf, function(t){
//	 if (config.provides == "android") {
//		 console.log("Skipping local replication on Android")
//		 t.end()
//	 } else {
		 common.compareDBSeqNums(t, {sourcedbs : dbs,
                              targetdbs : [sg.url]})
//	 }
})*/

test("delete confilcts in docs", test_conf, function(t){
  // start deleting docs
  common.deleteDBConflictDocs(t, dbs, numDocs)

})


test("done", function(t){
  common.cleanup(t, function(json){
    sg.kill()
    t.end()
  })
})


/*
 working!
test("delete db docs", test_conf, function(t){
  common.deleteDBDocs(t, dbs, numDocs)
})


test("verify local-replicated num-docs=0", function(t){
  common.verifyNumDocs(t, sg, 0)
})
*/
/*
// load databaes
test("load databases", test_conf, function(t){
  common.createDBDocs(t, {numdocs : numDocs, dbs : dbs})
})


test("doc update", test_conf, function(t){
  // start updating docs
  common.updateDBDocs(t, {dbs : [sgdbs[0]],
                          numrevs : 1,
                          numdocs : numDocs})
})


// purge all dbs
test("purge dbs", test_conf, function(t){
  common.purgeDBDocs(t, dbs, numDocs)
})

// check dbs
test("verify local-replicated in dbs: 0", test_conf, function(t){
  common.verifyNumDocs(t, dbs, 0)
})

// timing out and the compareDBSeqNums asserts are dubious so skipping for now
// test("verify local-replicated dbs changefeed", {timeout : 15000}, function(t){
//   common.compareDBSeqNums(t, {sourcedbs : dbs,
//                               targetdbs : repdbs})
// })

test("cleanup cb bucket", function(t){
    if (config.DbUrl.indexOf("http") > -1){
    coax.post([config.DbUrl, "pools/default/buckets/", config.DbBucket, "controller/doFlush"],
	    {"auth":{"passwordCredentials":{"username":"Administrator", "password":"password"}}}, function (err, js){
	      t.false(err, "flush cb bucket")
    })
    }
    t.end()
})

*/
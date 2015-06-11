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
 dbs = ["cbl-replication1", "cbl-replication2", "cbl-replication3"];
 // local->local dbs
 repdbs = ["cbl-replication4", "cbl-replication5", "cbl-replication6"];
 // sg->local dbs
 sgdbs = ["cbl-replication7", "cbl-replication8", "cbl-replication9"];

var numDocs=parseInt(config.numDocs) || 100;


//https://github.com/couchbase/couchbase-lite-android/issues/77
//support for shorthand target in local->local replication
//all android tests should be uncommented when the the issue will be resolved



// start client endpoint
test("start test client", function(t){
  common.launchClient(t, function(_server){
    server = _server;
    t.end();
  });
});

// start sync gateway
test("start syncgateway", function(t){
  common.launchSG(t, function(_sg){
    sg  = _sg;
    gateway = sg.url;
    t.end();
  });
});

// create all dbs
test("create test databases", function(t){
  var alldbs = dbs.concat(repdbs);
  alldbs = alldbs.concat(sgdbs);
  common.createDBs(t, alldbs);
});

//issue#77 couchbase-lite-android: support for shorthand target in local->local replication
// set up replication
test("set up local to local replication", function(t){
 if (config.provides == "android") {
	 console.log("Skipping local replication on Android");
	 t.end();
    return
  }

  var i = 0;
  async.mapSeries(dbs, function(db, cb){
    coax([server, "_replicate"]).post({
        source : db,
        // target : config.provides=="android" ? "http://localhost:8081/" + repdbs[i] : repdbs[i],
        // can be applied as workaround for shorthand issue
        // but seems like local replication doesn't work at all
        target :  repdbs[i],
        continuous : true,
      }, function(err, ok){
        t.equals(err, null, util.inspect({_replicate : dbs[i]+" -> "+repdbs[i]}));
        i++;
        cb(err, ok);
      });

  }, function(err, json){
    t.end();
  });

});

// setup push/pull replication to gateway
test("set push/pull replication to gateway", function(t){

  var i = 0;
  var gatewayDB = coax([gateway, config.DbBucket]).pax().toString();
  if (config.provides=="android") gatewayDB = gatewayDB.replace("localhost", "10.0.2.2");
  async.series([
    function(sgpush){

      async.mapSeries(dbs, function(db, cb){

        coax([server, "_replicate"]).post({
            source : db,
            target : gatewayDB,
            continuous : true,
          }, function(err, ok){
            t.equals(err, null,
              util.inspect({_replicate : db+" -> " + gatewayDB}));
            i++;
            cb(err, ok);
          });

      }, sgpush);
    },
    function(sgpull){

      async.mapSeries(sgdbs, function(db, cb){

        coax([server, "_replicate"]).post({
            source : gatewayDB,
            target : db,
            continuous : true,
          }, function(err, ok){

            t.equals(err, null,
              util.inspect({_replicate : db+" <- " + gatewayDB}));
            i++;
            cb(err, ok);
          });

      }, sgpull);
    }], function(err, json){
            t.false(err, "setup push pull replication to gateway")
            t.end();
    });

})

test("load databases", test_conf, function(t){
  common.createDBDocs(t, {numdocs : numDocs, dbs : dbs});
})

test("verify local-replicated dbs changefeed after load databases", test_conf, function(t){
	 if (config.provides == "android") {
		 console.log("Skipping local replication on Android");
		 t.end();
	 } else {
		 common.compareDBSeqNums(t, {sourcedbs : dbs,
                              targetdbs : repdbs});
	 }
})

test("verify local-replicated num-docs=" + numDocs, function(t){
	 if (config.provides == "android") {
		 console.log("Skipping local replication on Android");
		 t.end();
	 } else {
		 common.verifyNumDocs(t, repdbs, numDocs);
	 }
})

test("verify sg-replicated dbs loaded", test_conf, function(t){
	 if (config.provides == "android") {
		 console.log("Skipping local replication on Android");
		 t.end();
	 } else {
		 common.compareDBSeqNums(t, {sourcedbs : dbs,
                              targetdbs : sgdbs,
                              replfactor : 3});
	 }
})

test("verify sg-replicated num-docs", function(t){
	 if (config.provides == "android") {
		 console.log("Skipping local replication on Android");
		 t.end();
	 } else {
		  common.verifyNumDocs(t, sgdbs, numDocs*3);
	 }
})


test("delete db docs", test_conf, function(t){
  common.deleteDBDocs(t, dbs, numDocs);
})


test("verify local-replicated dbs changefeed after delete db docs", test_conf, function(t){
	 if (config.provides == "android") {
		 console.log("Skipping local replication on Android");
		 t.end();
	 } else {
		 common.compareDBSeqNums(t, {sourcedbs : dbs,
                              targetdbs : repdbs});
	 }
})


test("verify local-replicated num-docs 0", function(t){
  common.verifyNumDocs(t, repdbs, 0);
})

test("verify sg-replicated dbs loaded", test_conf, function(t){
	 if (config.provides == "android") {
		 console.log("Skipping local replication on Android");
		 t.end();
	 } else {
		 common.compareDBSeqNums(t, {sourcedbs : dbs,
                              targetdbs : sgdbs,
                              replfactor : 3});
	 }
})

test("verify sg-replicated num-docs", function(t){
	 if (config.provides == "android") {
		 console.log("Skipping local replication on Android");
		 t.end();
	 } else {
		 common.verifyNumDocs(t, sgdbs, 0);
	 }
})


// load databaes
test("load databases", test_conf, function(t){
  common.createDBDocs(t, {numdocs : numDocs, dbs : dbs});
})

test("verify local-replicated in repdbs: " + numDocs, test_conf, function(t){
	 if (config.provides == "android") {
		 console.log("Skipping local replication on Android");
		 t.end();
	 } else {
		 common.verifyNumDocs(t, repdbs, numDocs);
	 }
})

// purge all dbs
test("purge dbs", test_conf, function(t){
  common.purgeDBDocs(t, dbs, numDocs);
});

// check dbs
test("verify local-replicated in dbs: 0", test_conf, function(t){
  common.verifyNumDocs(t, dbs, 0);
})

// timing out and the compareDBSeqNums asserts are dubious so skipping for now
 test("verify local-replicated dbs changefeed", {timeout : 15000}, function(t){
     if (config.provides == "android") {
	 console.log("Skipping local replication on Android");
	 t.end();
     } else {
	 common.compareDBSeqNums(t, {sourcedbs : dbs,
                               targetdbs : repdbs})
	}
 })

test("cleanup cb bucket", function(t){
    if (config.DbUrl.indexOf("http") > -1){
    coax.post([config.DbUrl + "/pools/default/buckets/" + config.DbBucket + "/controller/doFlush"],
	    {"auth":{"passwordCredentials":{"username":"Administrator", "password":"password"}}}, function (err, js){
	      t.false(err, "flush cb bucket")
	    },
	    setTimeout(function(){
		 t.end();
	            }, test_time/10));
	}else{
	    t.end();
	}
})

test("done", function(t){
  common.cleanup(t, function(json){
    sg.kill();
    t.end();
  });
});
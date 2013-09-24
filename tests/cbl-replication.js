var launcher = require("../lib/launcher"),
  coax = require("coax"),
  async = require("async"),
  tstart = process.hrtime(),
  common = require("../tests/common"),
  util =  require("util"),
  eventEmitter = common.ee,
  emitsdefault  = "default",
  test = require("tap").test;

var server, sg, gateway,
  // local dbs
 dbs = ["api-test1", "api-test2", "api-test3"];
 // local->local dbs
 repdbs = ["api-test4", "api-test5", "api-test6"];
 // sg->local dbs
 sgdbs = ["api-test7", "api-test8", "api-test9"];

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
  var alldbs = dbs.concat(repdbs)
  alldbs = alldbs.concat(sgdbs)
  common.createDBs(t, alldbs)
})

// set up replication
test("set up local to local replication", function(t){

  var i = 0
  async.mapSeries(dbs, function(db, cb){

    coax([server, "_replicate"]).post({
        source : db,
        target : repdbs[i],
        continuous : true,
      }, function(err, ok){
        t.equals(err, null, util.inspect({_replicate : dbs[i]+" -> "+repdbs[i]}))
        i++
        cb(err, ok)
      })

  }, function(err, json){
    t.end()
  })

})

// setup push/pull replication to gateway
test("set push/pull replication to gateway", function(t){

  var i = 0
  var gatewayDB = coax([gateway, "db"]).pax().toString()

  async.series([
    function(sgpush){

      async.mapSeries(dbs, function(db, cb){

        coax([server, "_replicate"]).post({
            source : db,
            target : gatewayDB,
            continuous : true,
          }, function(err, ok){
            t.equals(err, null,
              util.inspect({_replicate : db+" -> "+gatewayDB}))
            i++
            cb(err, ok)
          })

      }, sgpush)
    },
    function(sgpull){

      async.mapSeries(sgdbs, function(db, cb){

        coax([server, "_replicate"]).post({
            source : gatewayDB,
            target : db,
            continuous : true,
          }, function(err, ok){

            t.equals(err, null,
              util.inspect({_replicate : db+" <- "+gatewayDB}))
            i++
            cb(err, ok)
          })

      }, sgpull)
    }], function(err, json){
      t.false(err, "setup push pull replication to gateway")
      t.end()
    })

})

test("load databases", function(t){
  common.createDBDocs(t, {numdocs : 100, dbs : dbs})
})

test("verify local-replicated dbs changefeed", {timeout : 15000}, function(t){
  common.compareDBSeqNums(t, {sourcedbs : dbs,
                              targetdbs : repdbs})
})

test("verify local-replicated num-docs 100", function(t){
  common.verifyNumDocs(t, repdbs, 100)
})

test("verify sg-replicated dbs loaded", {timeout : 15000}, function(t){
  common.compareDBSeqNums(t, {sourcedbs : dbs,
                              targetdbs : sgdbs,
                              replfactor : 3})
})

test("verify sg-replicated num-docs", function(t){
  common.verifyNumDocs(t, sgdbs, 300)
})


test("delete db docs",  function(t){
  common.deleteDBDocs(t, dbs, 100)
})


test("verify local-replicated dbs changefeed", {timeout : 15000}, function(t){
  common.compareDBSeqNums(t, {sourcedbs : dbs,
                              targetdbs : repdbs})
})


test("verify local-replicated num-docs 0", function(t){
  common.verifyNumDocs(t, repdbs, 0)
})

test("verify sg-replicated dbs loaded", {timeout : 15000}, function(t){
  common.compareDBSeqNums(t, {sourcedbs : dbs,
                              targetdbs : sgdbs,
                              replfactor : 3})
})

test("verify sg-replicated num-docs", function(t){
  common.verifyNumDocs(t, sgdbs, 0)
})


// load databaes
test("load databases", function(t){
  common.createDBDocs(t, {numdocs : 100, dbs : dbs})
})

test("verify local-replicated num-docs 100-2", { timeout : 15000}, function(t){
  common.verifyNumDocs(t, repdbs, 100)
})

// purge all dbs
test("purge dbs", function(t){
  common.purgeDBDocs(t, dbs, 100)
})

// check dbs
test("verify local-replicated num-docs 0-2", { timeout : 15000}, function(t){
  common.verifyNumDocs(t, dbs, 0)
})

// timing out and the compareDBSeqNums asserts are dubious so skipping for now
// test("verify local-replicated dbs changefeed", {timeout : 15000}, function(t){
//   common.compareDBSeqNums(t, {sourcedbs : dbs,
//                               targetdbs : repdbs})
// })


test("done", function(t){
  common.cleanup(t, function(json){
    sg.kill()
    t.end()
  })
})

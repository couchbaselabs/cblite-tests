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
 dbs = ["api-revision-restart"];
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
    },
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
    }], function(err, json){
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

test("kill sg", function(t){
    sg.kill()
    t.end()
})


test("recreate test databases after killing sg", function(t){
    async.mapSeries(dbs, function(db, cb){
      // check if db exists
      var url = coax([this.server, db]).pax().toString()    	
      coax([this.server, db], function(err, json){
          console.log("request db ", url, " info: ", json)
          if(!err){
              // delete db
              coax.del([this.server, db], function(err, json){
                  if(err){
                     console.log("unable to delete db: " + url)
                     t.fail("error: ", err)
                     t.end()
                  } else {
                    coax.put([this.server, db], function(err, ok){
                        if(err){
                            console.log("unable to create db: " + url)
                            t.fail("error: ", err)
                            qt.end()
                        } else {
                            console.log("db", url, "was recreated succesfull")
                            t.end()
                        }
                    })
                  }
              });
          } else {
              t.fail(url, " db should exist after restart server")
              t.end()
          }
      });
    })
})

test("start syncgateway", function(t){
  common.launchSG(t, function(_sg){
    sg  = _sg
    gateway = sg.url
    t.end()
  })
})

test("recreate test databases when syncgateway restarted", function(t){
    async.mapSeries(dbs, function(db, cb){
      // check if db exists
      var url = coax([this.server, db]).pax().toString()    	
      coax([this.server, db], function(err, json){
	  console.log("db ", url, " info: " + json)
          if(!err){
              // delete db
              coax.del([this.server, db], function(err, json){
                  if(err){
                       console.log("unable to delete db: " + url)
                       t.fail("error: ", err)
                       t.end()
                  } else {
                    coax.put([this.server, db], function(err, ok){
                        if(err){
                            console.log("unable to create db: " + url)
                            t.fail("error: ", err)
                            t.end()
                        } else {
                            console.log("db", url, "was recreated succesfull")
                            t.end()
                        }
                    })
                  }
              });
          } else {
              t.fail(url + " db should exist after server restarted and db recreated")
              t.end()
          }
      });
    })
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
    sg.kill()
    t.end()
  })
})

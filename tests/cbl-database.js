var launcher = require("../lib/launcher"),
  coax = require("coax"),
  async = require("async"),
  events = require('events'),
  config = require("../config/local"),
  test = require("tap").test;

var serve, gateway, port = 59850,
 dbs = ["api-test1", "api-test2", "api-test3"],
 server = "http://localhost:"+port+"/"

var eventEmitter = new events.EventEmitter();

test("can launch a LiteServ", function(t) {
  serve = launcher.launchLiteServ({
    port : port,
    dir : __dirname+"/../tmp/single",
    path : config.LiteServPath
  })
  serve.on("error", function(e){
    console.log("error launching LiteServe", e)
    t.fail("error launching LiteServe")
    t.end()
  })
  serve.once("ready", function(err){
    t.false(err, "no error, LiteServe running on our port")
    coax(server, function(err, ok){
      t.false(err, "no error, LiteServe reachable")
      t.end()
    })
  });
});

test("launch a Sync Gateway", function(t) {
  gateway = launcher.launchSyncGateway({
    port : 9888,
    dir : __dirname+"/../tmp/sg",
    path : config.SyncGatewayPath,
    configPath : config.SyncGatewayAdminParty
  })
  gateway.once("ready", function(err){
    t.false(err, "no error, Sync Gateway running on our port")
    gateway.db = coax([gateway.url,"db"])
    gateway.db(function(err, ok){
      t.false(err, "no error, Sync Gateway reachable")
      t.end()
    })
  });
});


test("session api", function(t){

  coax([server, "_session"] , function(err, ok){
    t.equals(ok.ok, true, "api exists")
    t.end()
  })
})

test("create test databases", function(t){
  createDBs(dbs, function(err, oks){
    t.false(err,"all dbs created")
    t.end()
  })
})


test("create duplicate db", function(t){
  coax.put([server, dbs[0]], function(err, json){
    t.equals(err.error,"file_exists", "db exists")
    t.end()
  })
})

test("db bad name", function(t){
  coax.put([server, ".*------------------???"], function(err, json){
    t.equals(err.status, 400, "bad request")
    t.end()
  })
})

test("longdbname", function(t){
  var db = "asfasdfasfasdfasdfasdfasfasjkfhslfkjhalkjfhajkflhskjdfhlkfhajkfheajfkaheflwkjhfawekfhelakjwehflawefhawklejfewhakjfhwaeflakwejfhwaelfhwejflawefhawelfjkhawelfjaeelkfhjaewkfhwaelfhkjwefhawlkejfwaflhewfafjekhwaelfkjahejklf"
  createDBs([db], function(err, oks){
    t.equals(err, null, "db with long name")
    t.end()
  })
})


test("load a test database", function(t){
  var numdocs = 100
  loadDBs(t, numdocs, [dbs[0]], t.end.bind(t))
})

test("verify db loaded", function(t){
  coax([server,dbs[0]], function(err, json){
    t.equals(json.doc_count, 100, "verify db loaded")
    t.end()
  })

})

test("compact db", function(t){
  coax.post([server,dbs[0], "_compact"], function(err, json){
    console.log(json)
    t.equals(err, null, "db compacted")
    t.end()
  })
})

test("compact during doc update", function(t){

  var numrevs = 1
  var numdocs = 100
  compactDuringUpdate(t, [dbs[0]], numrevs, numdocs, t.end.bind(t))

})



test("compact during doc delete", function(t){

  async.times(100, function(i, cb){

    var docid = "i"+i
    var url = coax([server,dbs[0], docid]).pax().toString()

    // get document rev
    coax(url, function(err, json){

      // delete doc
      coax.del([url+"?rev="+json._rev], cb)
    })

    // start compaction
    if (i == 20){
      eventEmitter.emit('docompaction')
    }

  }, function(err, results){
    t.equals(err, null, "docs deleted during compaction")
    t.equals(results.length, 100, "all docs compacted")
    t.end()
  })


  eventEmitter.on('docompaction', function(){
    coax.post([server,dbs[0], "_compact"], function(err, json){
      t.equals(err, null, "db compacted")
    })
  });

})

test("load multiple databases", function(t){
  var numdocs = 1000
  loadDBs(t, numdocs, dbs, t.end.bind(t))
})

test("compact during multi-db update", {timeout : 300000}, function(t){
  var numrevs = 10
  var numdocs = 1000
  compactDuringUpdate(t, dbs, numrevs, numdocs, t.end.bind(t))
})

test("done", function(t){
  serve.kill()
  gateway.kill()
  t.end()
})


function createDBs(dbs, done){

  async.map(dbs, function(db, cb){

    // check if db exists
    coax([server, db], function(err, json){
        if(!err){
            // delete db
            coax.del([server, db], function(err, json){
                if(err){
                  cb(err, json)
                } else {
                  coax.put([server, db], cb)
                }
            });
        } else {
            coax.put([server, db], cb)
        }
    });
  }, function(err, oks){
        done(err, oks)
  })
}

function loadDBs(t, numdocs, dbs, done){

  async.map(dbs, function(db, next){

    async.times(numdocs, function(i, cb){
      coax.post([server,db], {_id : "i"+i}, cb)
    }, next)

    }, function(err, json){
      t.equals(err, null, "loaded "+json.length+" dbs")
      done()
    })

}

function compactDuringUpdate(t, dbs, numrevs, numdocs, done){

  async.timesSeries(numrevs, function(revid, done){
    async.times(numdocs, function(i, cb){

      var docid = "i"+i
      var url = coax([server,dbs[0], docid]).pax().toString()

      // get document rev
      coax(url, function(err, json){
        if(err){
          t.fail("unable to get doc rev")
        }
        var doc = {_id : docid,
                   _rev : json._rev,
                   hello : 'world'}

        // put updated doc
        coax.put([url], doc, cb)
      })

      // start compaction halfway though
      if (i == 50){
        eventEmitter.emit('docompaction')
      }

    }, function(err, results){
      if(results.length !=  numdocs){
        t.fail("did not compact all docs")
      }

      done(err, results)
    })
  }, function(err, results){
    t.equals(err, null, "docs updated during compaction")
    done()
  })


  eventEmitter.on('docompaction', function(){
    coax.post([server,dbs[0], "_compact"], function(err, json){
      t.equals(err, null, "db compacted")
    })
  });



}

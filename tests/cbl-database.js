var launcher = require("../lib/launcher"),
  coax = require("coax"),
  async = require("async"),
  events = require('events'),
  config = require("../config/local"),
  test = require("tap").test;

var serve, port = 59850,
 dbs = ["api-test1", "api-test2", "api-test3"],
 server = "http://localhost:"+port+"/"
// server = "http://localhost:59820/"

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
  var numdocs = 100
  loadDBs(t, numdocs, dbs, t.end.bind(t))
})

test("compact during multi-db update", {timeout : 300000}, function(t){
  var numrevs = 5
  var numdocs = 100
  compactDuringUpdate(t, dbs, numrevs, numdocs, t.end.bind(t))
})


// expecting compacted revs to be 'missing'
test("verify compaction", function(t){

  var numdocs = 100

  async.map(dbs, function(db, done){

    async.times(numdocs, function(i, cb){

      // get doc revs info
      var docid = "i"+i
      var url = coax([server,db, docid]).pax().toString()
      url = url+"?revs_info=true"
      coax(url, function(err, json){

        if(err){
          t.fail("unable to get doc rev_info")
        }

        // expect only 1 available rev
        var revs_info = json._revs_info
        var num_avail = revs_info.filter(function(rev,i){
          if(rev.status == "available"){
            return true
          }}).length

        if(num_avail > 1){
            t.fail('uncompacted docs remain')
        }

        if(num_avail < 1){
            t.fail('no doc revisions available')
        }

        cb(err, json)
      })
    }, done)

  }, function(err, oks){
    // verify
    t.equals(err, null, "verify db compaction")
    t.end()
  })

})

// purge all dbs
test("test purge", function(t){

  var numDocsToPurge = 100
  purgeDBDocs(t, dbs, numDocsToPurge, t.end.bind(t))

})


// verify db purge
test("verify db purge doc_count", function(t){

  // expecting all documents deleted
  async.map(dbs, function(db, cb){
    coax([server,db], cb)
  }, function(e, responses){
    var numPurged = responses.filter(function(dbinfo){
      return dbinfo.doc_count == 0
      }).length
    t.equals(numPurged, dbs.length, "doc_count=0 on all dbs")
    t.end()
  })

})

test("done", function(t){
  serve.kill()
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

  async.map(dbs, function(db, dbdone){

    async.timesSeries(numrevs, function(revid, nextrev){

      async.times(numdocs, function(i, cb){

        var docid = "i"+i
        var url = coax([server,db, docid]).pax().toString()

        // get document rev
        coax(url, function(err, json){
          if(err || (!json)){
            t.fail("unable to get doc rev")
          }
          var doc = {_id : docid,
                     _rev : json._rev,
                     hello : 'world'}

          // put updated doc
          coax.put([url], doc, cb)
        })

        // start compaction halfway though
        if (i == Math.floor(numdocs/2)){
          eventEmitter.emit('docompaction', db)
        }

      }, function(err, results){
        if(results.length !=  numdocs){
          t.fail("did not compact all docs")
        }
        nextrev(err, results)
      })
    }, function(err, results){
      // final db compaction
      eventEmitter.emit('docompaction', db)
      dbdone(err, results)
    })
  }, function(err, results){
      t.equals(err, null, " updated and compacted "+results.length+" dbs")
      done()
  })


  eventEmitter.on('docompaction', function(db){
    coax.post([server, db, "_compact"], function(err, json){
      t.equals(err, null, "compacted "+db)
    })
  });


}

function purgeDBDocs(t, dbs, numdocs, done){

  async.map(dbs, function(db, dbdone){

    async.times(numdocs, function(i, cb){
      // get last rev
      var docid = "i"+i
      var url = coax([server,db, docid]).pax().toString()
      coax(url, function(err, json){
        if(err){
          t.fail("unable to retrieve doc ids")
        }

        // purge doc history
        var doc = {}
        doc[docid] = [json._rev]
        coax.post([server, db, "_purge"], doc, function(e, js){
          if(e){
            console.log(e)
            t.fail("unable to purge doc history")
          }
          cb(e,js)
        })
      })
    }, dbdone)

  }, function(err, oks){
    t.equals(err, null, "all doc history purged purged")
    done()
  })
}

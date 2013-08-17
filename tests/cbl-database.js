var launcher = require("../lib/launcher"),
  coax = require("coax"),
  async = require("async"),
  events = require('events'),
  config = require("../config/local"),
  test = require("tap").test;

var serve, port = 59850,
 dbs = ["api-test1", "api-test2", "api-test3"],
 server = "http://localhost:"+port+"/"

var eventEmitter = new events.EventEmitter();
var emitsdefault = "default";

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


// _session api
test("session api", function(t){

  coax([server, "_session"] , function(err, ok){
    t.equals(ok.ok, true, "api exists")
    t.end()
  })
})


test("create test databases", function(t){

  createDBs(dbs)
  eventEmitter.once(emitsdefault, emitHandler.bind(t))
})

test("try to create a database with caps", function(t){
    coax.put([server, "dbwithCAPS"], function(e, js){
      t.equals(e.status, 400, "db with caps not allowed")
      t.end()
    })
})

test("longdbname", function(t){

  // try to exceed max db length of  240
  var db = "asfasdfasfasdfasdfasdfasfasjkfhslfkjhalkjfhajkflhskjdfhlkfhajkfheajfkaheflwkjhfawekfhelakjwehflawefhawklejfewhakjfhwaeflakwejfhwaelfhwejflawefhawelfjkhawelfjaeelkfhjaewkfhwaelfhkjwefhawlkejfwaflhewfafjekhwaelfkjahejklfakfdsldlflsldlfkdfszdkf"
  coax.put([server, db], function(e, js){
    t.equals(e.status, 400, "dbname "+db.length+" is > 240 chars (not allowed)")
    t.end()
  })

})


test("create special char dbs", function(t){

  var specialdbs = ["un_derscore", "dollar$ign","left(paren", "right)paren", "c+plus+plus+", "t-minus1", "foward/slash"]
  createDBs(specialdbs)
  eventEmitter.once(emitsdefault, emitHandler.bind(t))

})

test("create duplicate db", function(t){
  coax.put([server, dbs[0]], function(e, js){
    t.equals(e.status, 412, "db exists")
    t.end()
  })
})

test("db bad name", function(t){
  coax.put([server, ".*------------------???"], function(err, json){
    t.equals(err.status, 400, "bad request")
    t.end()
  })
})

test("load a test database", function(t){
  var numdocs = 100
  createDBDocs(numdocs, [dbs[0]])
  eventEmitter.once(emitsdefault, emitHandler.bind(t))
})

test("verify db loaded", function(t){
  coax([server,dbs[0]], function(err, json){
    t.equals(json.doc_count, 100, "verify db loaded")
    t.end()
  })

})

test("all docs", function(t){

  var db = dbs[0]
  coax([server, db, "_all_docs"], function(e, js){
    t.equals(js.rows.length, 100, "verify _all_docs")
    t.end()
  })
})

test("all docs with keys", function(t){

  var db = dbs[0]
  coax([server, db, "_all_docs"], function(e, js){

    // get a subset of all docs
    var keys = js.rows.map(function(row){
      return row.key
    }).slice(0,20)

    var params = {keys : keys}
    coax.post([server, db, "_all_docs"], params, function (e, js){

      var resultkeys = js.rows.map(function(row){
        return row.key
      })

      t.equals(resultkeys.length, 20, "verify _all_docs")

      for(var i in keys){
        if(resultkeys.indexOf(keys[i]) == -1){
          t.fail("expected key ("+keys[i]+") not found in _all_docs")
        }
      }
      t.end()
    })
  })
})


test("compact db", function(t){
  compactDBs([dbs[0]])
  eventEmitter.once(emitsdefault, emitHandler.bind(t))
})


test("compact during doc update", function(t){
  var numrevs = 5
  var numdocs = 100
  var dbsToUpdate = [dbs[0]]
  updateDBDocs(t, dbsToUpdate, numrevs, numdocs, "done")

  // run compaction while documents are updating
  eventEmitter.once("docsUpdating", function(){
    compactDBs(dbsToUpdate)
  })

  // handle update completes
  eventEmitter.once("done", emitHandler.bind(t))
})


test("compact during doc delete", function(t){
  var numdocs = 100
  deleteDBDocs(t, [dbs[0]], numdocs)

  // run compaction while documents are being deleted
  compactDBs([dbs[0]], 'compactDBs')

  // handle update completes
  eventEmitter.once(emitsdefault, emitHandler.bind(t))

})


test("load multiple databases", function(t){
  var numdocs = 100
  createDBDocs(numdocs, dbs)
  eventEmitter.once(emitsdefault, emitHandler.bind(t))
})


test("compact during multi-db update", {timeout : 300000}, function(t){
  var numrevs = 5
  var numdocs = 100
  updateDBDocs(t, dbs, numrevs, numdocs)

  // run compaction while documents are updating
  eventEmitter.once("docsUpdating", function(){
    compactDBs(dbs, 'compactDBs')
  })

  // handle update completes
  eventEmitter.once(emitsdefault, function(err, json){
    if(err){
      console.log(err)
      t.fail("errors occured updating docs during compaction")
    }

    // final compaction
    compactDBs(dbs)
    eventEmitter.once(emitsdefault, emitHandler.bind(t))
  })

})


// expecting compacted revs to be 'missing'
test("verify compaction", function(t){
  var numdocs = 100
  verifyCompactDBs(t, dbs, numdocs)
  eventEmitter.once(emitsdefault, emitHandler.bind(t))

})


// purge all dbs
test("test purge", function(t){
  var numDocsToPurge = 100
  purgeDBDocs(t, dbs, numDocsToPurge)
  eventEmitter.once(emitsdefault,  emitHandler.bind(t))

})


// verify db purge
test("verify db purge doc_count", function(t){
  verifyPurgeDocCount(t, dbs)
  eventEmitter.once(emitsdefault,  emitHandler.bind(t))

})


// reload some more docs
test("reload databases", function(t){
  var numdocs = 100
  createDBDocs(numdocs, dbs)
  eventEmitter.once(emitsdefault, emitHandler.bind(t))

})

// rev history should restart
test("verify revids after purge", function(t){
  verifyPurgeRevIDs(t, dbs)
  eventEmitter.once(emitsdefault, emitHandler.bind(t))
})




//########## helper methods ################


function createDBs(dbs, emits){

  emits = emits || emitsdefault

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
  }, notifycaller(emits))
}


function createDBDocs(numdocs, dbs, emits){

  emits = emits || emitsdefault

  async.map(dbs, function(db, nextdb){

    async.times(numdocs, function(i, cb){
      coax.post([server,db], {_id : "i"+i}, cb)
    }, nextdb)

  }, notifycaller(emits))

}


function updateDBDocs(t, dbs, numrevs, numdocs, emits){

  emits = emits || emitsdefault

  async.map(dbs, function(db, nextdb){

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

      },
      notifycaller({emits : "docsUpdating" , cb : nextrev}))

    }, nextdb)

  }, notifycaller(emits))

}

function deleteDBDocs(t, dbs, numdocs, emits){

  emits = emits || emitsdefault

  async.map(dbs, function(db, nextdb) {

    async.times(numdocs, function(i, cb){

      var docid = "i"+i
      var url = coax([server,db, docid]).pax().toString()

      // get document rev
      coax(url, function(err, json){

        if(err){
          t.fail("unable to get doc to delete")
        }

        // delete doc
        coax.del([url+"?rev="+json._rev], cb)
      })

    }, function(err, json){
      t.equals(json.length, 100, "all docs deleted")
      nextdb(err, json)
    })

  }, notifycaller(emits))

}


function compactDBs(dbs, emits){

  emits = emits || emitsdefault

  async.map(dbs, function(db, nextdb){
    coax.post([server, db, "_compact"], nextdb)
  }, notifycaller(emits))

}

function verifyCompactDBs(t, dbs, numdocs, emits){

  emits = emits || emitsdefault

  async.map(dbs, function(db, nextdb){

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
            t.fail(num_avail+' uncompacted revision(s) remain')
        }

        if(num_avail < 1){
            t.fail('no doc revisions available')
        }

        cb(err, json)
      })
    }, nextdb)

  }, notifycaller(emits))

}

function purgeDBDocs(t, dbs, numdocs, emits){

  emits = emits || emitsdefault

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

  }, notifycaller(emits))
}

// runs after purge to verify all doc_count=0 on all dbs
function verifyPurgeDocCount(t, dbs){

  // expecting all documents deleted
  async.map(dbs, function(db, cb){
    coax([server,db], cb)
  }, function(e, responses){
    var numPurged = responses.filter(function(dbinfo){
      return dbinfo.doc_count == 0
      }).length
    t.equals(numPurged, dbs.length, "doc_count=0 on all dbs")

    // emits default
    notifycaller(emitsdefault)(e, responses)

  })

}

// runs after purge to verify all doc ids=1 on any existing doc
// TODO: use _all_docs?
function verifyPurgeRevIDs(t, dbs){

  // get 1 doc from each db
  async.map(dbs, function(db, cb){
    coax([server,db,"i1"], function(e, js){
      if(e){
        t.fail("unable to retrieve db doc")
      }
      var revid = js._rev.replace(/-.*/,"")
      t.equals(revid, "1", db+" revids reset")
      cb(e, revid)
    })
  }, notifycaller(emitsdefault))

}

// emitHandler: does final test verification
//
// this method helps to finish a test in an async way
// by running in the context of the test when called
// properly via bind. custom handlers can be written for
// special use cases if needed
//
// * make sure no errors encountered
// * prints errors if any
function emitHandler(err, oks){
  if(err){
    this.fail("errors occured during test case")
    console.log(err)
  }

  this.end()
}


// multi-purpose helper for async methods
//
// primary purpose is to return a callback which complies with completion of async loops
// * can emit an event on completion
// * can emit an event during innter loop completion and call it's callback
function notifycaller(args){

  if(args && typeof(args) == 'string'){
    args = {emits : args}
  }

  return function(err, json){


    if(args){
      if(args.emits){
        eventEmitter.emit(args.emits, err, json)
      }

      if(args.cb){
        args.cb(err, json)
      }
    }
  }

}

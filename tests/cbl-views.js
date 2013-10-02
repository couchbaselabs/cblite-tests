var launcher = require("../lib/launcher"),
  coax = require("coax"),
  async = require("async"),
  tstart = process.hrtime(),
  common = require("../tests/common"),
  util =  require("util"),
  eventEmitter = common.ee,
  docgens = common.generators,
  emitsdefault  = "default",
  test = require("tap").test;

var server, sg, gateway, db

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
test("create test database", function(t){
  db = coax([server, 'cbl_views'])

  db(function(err, ok){

    // always attempt to recreate db
    db.del(function(){
      db.put(function(err, ok){
            t.false(err, "test db reachable")
            t.end()
      })
    })
  })
})

test("simple map function", function(t){

    // ddoc spec
    var designDoc = {
      _id:"_design/test",
      views: {
        basic: {
          map: "function(doc) { emit(doc._id, doc.foo) }"
          }
        }
      }

    // create 10 docs
    common.createDBDocs(t, {dbs : ["cbl_views"],
                            docgen : 'foobar',
                            numdocs: 10}, 'docs_created')

    eventEmitter.on('docs_created', function(err, json){

      t.false(err, "docs_created")

      db.post(designDoc, function(e, js){
        t.false(e, "can create design doc")

        var view = db(['_design','test','_view','basic'])
        view(function(e, js){
          t.equals(js.rows.length, 10)
          t.equals(js.rows[0].value, docgens.foobar().foo)
          t.end()
        })

      })

    })
})

test("test query filters", function(t){

  var view = db(['_design','test','_view','basic'])

  // descending
  view({descending : true}, function(e, js){
    t.equals(e, null)
    var oks = js.rows.filter(function(row, i){
      return (row.key == "cbl_views_"+(9 - i))
    })
    t.equals(oks.length, 10, "descending")
  })

  // key
  view({ key : "cbl_views_5" }, function(e, js){
    t.equals(js.rows[0].key, "cbl_views_5", "key")
  })

  // keys
  view({ keys : '["cbl_views_3", "cbl_views_4", "cbl_views_5"]' }, function(e, js){
    t.equals(js.rows[0].key, "cbl_views_3", "keys")
    t.equals(js.rows[1].key, "cbl_views_4", "keys")
    t.equals(js.rows[2].key, "cbl_views_5", "keys")
  })

  // startkey
  view({ startkey : "cbl_views_5" }, function(e, js){
    var oks = js.rows.filter(function(row, i){
      return (row.key == "cbl_views_"+(i+5))
    })
    t.equals(oks.length, 5, "startkey")
  })

  // endkey
  view({ endkey : "cbl_views_5", inclusive_end : false }, function(e, js){
    var oks = js.rows.filter(function(row, i){
      return (row.key == "cbl_views_"+(i))
    })
    t.equals(oks.length, 5, "endkey")
  })

  // limit
  view({ limit: "5" }, function(e, js){
    var oks = js.rows.filter(function(row, i){
      return (row.key == "cbl_views_"+(i))
    })
    t.equals(oks.length, 5, "limit")
  })

  // include_docs
  view({ include_docs : true }, function(e, js){
    var oks = js.rows.filter(function(row, i){
      return (row.doc.foo == docgens.foobar().foo &&
                row.doc._id == "cbl_views_"+i)
    })
    t.equals(oks.length, 10, "include_docs")
  })

  // update_seq
  view({ update_seq : true}, function(e, js){
    t.equals(js.update_seq, 11, "update_seq")
  })

  // skip
  view({ skip: "5" }, function(e, js){
    if(!e){
      var oks = js.rows.filter(function(row, i){
        return (row.key == "cbl_views_"+(i + 5))
      })
      t.equals(oks.length, 5)
    } else {
      t.fail("skip: "+ util.inspect(e))
    }
    t.end()
  })


})


test("delete db docs",  function(t){
  common.deleteDBDocs(t, ["cbl_views"], 10)
})

test("create player docs", function(t){
    common.createDBDocs(t, {dbs : ["cbl_views"],
                            docgen : 'player',
                            numdocs: 10})
})


test("update ddoc with player view", function(t){

  var ddoc = db(['_design','test'])
  ddoc(function(err, js){
    js.views['player'] = {
        map: "function(doc) { emit(doc.joined, doc.points) }",
        // https://github.com/couchbase/couchbase-lite-ios/issues/76
        // reduce : "function(keys, values, rereduce) { return sum(values)  }"
        reduce : "function(keys, values, rereduce) { return values.reduce(function(a, b) { return a + b })  }"
      }
    db.post(js, function(e, js){
      t.false(e, "can update design doc")
      t.end()
    })
  })

})


// group queries
test("test array keys", function(t){

  var view = db(['_design','test','_view','player'])

  view({ startkey : [2013, 7, 2], reduce : false }, function(e, js){
    var oks = js.rows.filter(function(row, i){
      return row.key[2] == (i+2)
    })
    t.equals(oks.length, 8, "startkey array")
  })

// TODO these should be individual tests
  // view({ startkey : [2013, 7, 2], startkey_docid : "cbl_views_8", reduce : false},
  //   function(e, js){
  //     var oks = js.rows.filter(function(row, i){
  //       console.log(row)
  //       return row.key[2] == (i+4)
  //     })
  //     t.equals(oks.length, 8, "startkey array")
  // })


  view({ group : true}, function(e, js){
    var oks = js.rows.filter(function(row, i){
        return row.value == (i)
    })
    t.equals(oks.length, 10, "group true")
  })

  view({ group : true, group_level : 2}, function(e, js){
    t.equals(js.rows[0].key.length, 2, "group level=2 keys length")
    t.equals(js.rows[0].value, 45, "group_level=2 value")
  })

  view({ group : true, group_level : 1}, function(e, js){
    t.equals(js.rows[0].key.length, 1, "group level=1 keys length")
    t.equals(js.rows[0].value, 45, "group_level=1 value")
    t.end()
  })

})


test("done", function(t){
  common.cleanup(t, function(json){
    sg.kill()
    t.end()
  })
})

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

var serve, server, sg, gateway, db

// start liteserver endpoint
test("start liteserv", function(t){
  common.launchLS(t, function(_serve){
    serve = _serve
    server = serve.url
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
  // https://github.com/couchbase/couchbase-lite-ios/issues/109
  // will cause internal error for all tests
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

test("done", function(t){

  serve.kill()
  sg.kill()
  t.end()

})

var launcher = require("../lib/launcher"),
  coax = require("coax"),
  async = require("async"),
  tstart = process.hrtime(),
  common = require("../tests/common"),
  utils = common.utils,
  ee = common.ee,
  emitsdefault  = "default",
  test = require("tap").test;

var serve, server,
 dbs = ["api-test1", "api-test2", "api-test3"];

// start liteserver endpoint
test("start liteserv", function(t){
  common.launchLS(t, function(_serve){
    serve = _serve
    server = serve.url
    t.end()
  })
})


test("create test databases", function(t){
  common.createDBs(t, dbs)
})

test("create docs with inline text attachments", function(t){
  common.createDBDocs(t, {numdocs : 100,
                          dbs : dbs,
                          docgen : 'inlineTextAtt'}, 'emits-created')

  ee.once('emits-created', function(e, js){
    t.false(e, "created docs with attachment")

    // get doc
    coax([server, dbs[0], "_all_docs", {limit : 1}], function(e, js){

      if(e){
        console.log(e)
        t.fail("unable to retrieve doc from all_docs")
      }

      // get doc with attachement info
      var docid = js.rows[0].id
      coax([server, dbs[0], docid, { attachements : true }], function(e, js){

        if(e){
          console.log(e)
          t.fail("read doc failed")
        }

        // get just attachement
        var doctext = js.text
        var attchid = Object.keys(js._attachments)[0]
        coax([server, dbs[0], docid, attchid], function(e, response){

          // search for cblite string
          t.false(e, "retrieved doc with attachement")
          t.ok(doctext == response, "verify attachment data")
          t.end()
        })
      })
    })
  })
})

// purge all dbs
test("test purge", function(t){
  var numDocsToPurge = 100
  common.purgeDBDocs(t, dbs, numDocsToPurge)

})

test("create docs with image attachements", function(t){

 common.createDBDocs(t, {numdocs : 100,
                          dbs : dbs,
                          docgen : 'inlinePngtAtt'}, 'emits-created')

  ee.once('emits-created', function(e, js){

    t.false(e, "created docs with attachment")

    // get doc
    coax([server, dbs[0], "_all_docs", {limit : 1}], function(e, js){

      if(e){
        console.log(e)
        t.fail("unable to retrieve doc from all_docs")
      }

      // get doc with attachement info
      var docid = js.rows[0].id
      coax([server, dbs[0], docid, { attachements : true }], function(e, js){

        if(e){
          console.log(e)
          t.fail("read doc failed")
        }

        // get just attachement
        var doctext = js.text
        var attchid = Object.keys(js._attachments)[0]
        coax([server, dbs[0], docid, attchid], function(e, response){

          // search for cblite string
          t.false(e, "retrieved doc with attachement")
            t.ok(response.slice(1,4) == "PNG", "verify img attachement")
            t.end()
        })
      })
    })

  })

})

test("multi inline attachements", function(t){

 common.updateDBDocs(t, {numdocs : 100,
                         numrevs : 3,
                         dbs : dbs,
                         docgen : 'inlineTextAtt'}, 'emits-updated')

  ee.once('emits-updated', function(e, js){

    t.false(e, "added attachment to docs")

    // get doc
    coax([server, dbs[0], "_all_docs", {limit : 1}], function(e, js){

      if(e){
        console.log(e)
        t.fail("unable to retrieve doc from all_docs")
      }

      // get doc with attachement info
      var docid = js.rows[0].id
      coax([server, dbs[0], docid, { attachements : true }], function(e, js){

        if(e){
          console.log(e)
          t.fail("read doc failed")
        }

        // verify text attachement
        var doctext = js.text
        var attchid = Object.keys(js._attachments)[1]

        coax([server, dbs[0], docid, attchid], function(e, response){

          // search for cblite string
          t.false(e, "retrieved doc with attachement")
          t.ok(doctext == response, "verify attachment data")
          t.end()
        })
      })
    })

  })
})


// compact db
test("compact db", function(t){
  common.compactDBs(t, dbs)

})

// expecting compacted revs to be 'missing'
test("verify compaction", function(t){
  common.verifyCompactDBs(t, dbs, 100)
})

test("delete doc attachments", function(t){
  common.deleteDBDocAttachments(t, dbs, 100)
})


test("delete db docs", function(t){
  common.deleteDBDocs(t, dbs, 100)
})

test("create attachments using bulk docs", function(t){
  common.createDBBulkDocs(t, {numdocs : 1000,
                              docgen : 'bulkInlineTextAtt',
                              dbs : dbs})
})


test("verify db loaded", function(t){
  coax([server, dbs[0]], function(err, json){
    t.equals(json.doc_count, 1000, "verify db loaded")

    // get doc
    coax([server, dbs[0], "_all_docs", {limit : 1}], function(e, js){

      if(e){
        console.log(e)
        t.fail("unable to retrieve doc from all_docs")
      }

      // get doc with attachement info
      var docid = js.rows[0].id
      coax([server, dbs[0], docid, { attachements : true }], function(e, js){

        if(e){
          console.log(e)
          t.fail("read doc failed")
        }

        // get just attachement
        var doctext = js.text
        var attchid = Object.keys(js._attachments)[0]
        coax([server, dbs[0], docid, attchid], function(e, response){

          // search for cblite string
          t.false(e, "retrieved doc with attachement")
          t.ok(doctext == response, "verify attachment data")
          t.end()
        })
      })
    })

  })
})



// X multi attachements (inline | external)

// X update attachements (inline | external)

// X delete attachements (inline | external)

// X bulkdoc attachments (inline | external)

// bulkdoc multi attachements (inline | external)

// update bulkdoc multi attachements (inline | external)

// get changed attachments

// X compact (inline | external)

// save local docs (inline | external)

// save local docs with attachment (inline | external)

// big docs

// bad ids

// nonjson data

// doc expire

test("done", function(t){

  serve.kill()
  t.end()

})



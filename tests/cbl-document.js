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

  ee.on('emits-created', function(e, js){
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

  ee.on('emits-created', function(e, js){

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


// multi attachements (inline | external)

// update attachements (inline | external)

// delete attachements (inline | external)

// bulkdoc attachments (inline | external)

// bulkdoc multi attachements (inline | external)

// update bulkdoc multi attachements (inline | external)

// get changed attachments

// compact (inline | external)

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



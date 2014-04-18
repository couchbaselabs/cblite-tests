var launcher = require("../lib/launcher"),
    coax = require("coax"),
    common = require("../tests/common"),
    ee = common.ee,
    test = require("tap").test,
    test_time = process.env.TAP_TIMEOUT || 30,
    test_conf = {
        timeout: test_time * 1000
    };

var server, sg, gateway,
    // local dbs
    dbs = ["bigtable"];


var numDocs = parseInt(config.numDocs) || 100;
//var timeoutReplication = 0;
//if (config.provides=="android") timeoutReplication = 30000 * numDocs;

// start client endpoint
test("start test client", function (t) {
    common.launchClient(t, function (_server) {
        server = _server;
        t.end();
    });
});

// create all dbs
test("create test databases", function (t) {
    common.createDBs(t, dbs);
});
/*
test("load databases with large JSON ~4MB", test_conf, function (t) {
    common.createDBDocs(t, {
        numdocs: numDocs,
        dbs: dbs,
        docgen: 'inlineTextLargeJSON'
    }, 'emits-created');

    ee.once('emits-created', function (e, js) {
        t.false(e, "created basic local docs");

        // get doc
        coax([server, dbs[0], dbs[0] + "_0"], function (e, js) {

            if (e) {
                t.fail("unable to retrieve doc wiht large json:" + dbs[0] + "/" + dbs[0] + "_0: ", e);
            }

            var docid = js._id;
            coax([server, dbs[0], docid, {
                attachments: true,
            }], function (e, js) {

                if (e) {
                    t.fail("read doc with large json data: ", e);
                }

                var docdata = js.jsooooon;
                if( docdata!=new Array(4000000).join("x")){
                	t.fail("docdata is not correct!: ", docdata);
            	}
                t.end();
            });
        });
    });
});


test("test purge", test_conf, function(t){
	  common.purgeDBDocs(t, dbs, numDocs)
	})
	
// recreate all dbs/workaround
test("create test databases", function (t) {
    common.createDBs(t, dbs);
});
*/

test("create docs with image attachments", test_conf, function (t) {
    common.createDBDocs(t, {
        numdocs: numDocs,
        dbs: dbs,
        docgen: 'inlineTextAtt'
    }, 'emits-created')

    ee.once('emits-created', function (e, js) {

        t.false(e, "created docs with image attachments")

        // get doc
        coax([server, dbs[0], "_all_docs", {
            limit: 1
        }], function (e, js) {

            if (e) {
                var urlAllDocs = coax([server, dbs[0], "_all_docs", {
                    limit: 1
                }]).pax().toString()
                t.fail("unable to retrieve doc from all_docs " + urlAllDocs + ": " + e)
            }

            // get doc with attachment info
            var docid = js.rows[0].id
            coax([server, dbs[0], docid, {
                attachments: true
            }], function (e, js) {
                var urlWithAtt = coax([server, dbs[0], docid, {
                    attachments: true
                }]).pax().toString()
                if (e) {
                    t.fail("read doc " + urlWithAtt + ": " + JSON.stringify(e))
                }

                // get just attachment
                var attchid = Object.keys(js._attachments)[0]
                var url = coax([server, dbs[0], docid, attchid]).pax().toString()
                coax([server, dbs[0], docid, attchid], function (e, response) {
                	t.end()
                    //try to get just attachment with header like
                    //curl -X GET -H 'Accept: applicatio/json' http://127.0.0.1:59851/cbl-document1/cbl-document1_0?attachments=true
                    //{"status" : 406, "error" : "not_acceptable"}
//
//                    if (e) {
//                        t.equals(JSON.stringify(e), JSON.stringify({
//                                "status": 406,
//                                "error": "not_acceptable"
//                            }),
//                            "status is not correct: " + JSON.stringify(e))
//                        var options = {
//                            host: config.LocalListenerIP,
//                            port: port,
//                            path: dbs[0] + '/' + docid + "/" + attchid,
//                            method: 'GET',
//                        }
//                        common.http_get_api(t, options, 200, function (callback) {
//                            t.ok(callback.toString().slice(1, 4) == "PNG", "verify img attachment. Got attachment file type from " + url + ": " + callback.toString().slice(1, 4))
//                            t.end()
//                        })
//                    } else {
//                        t.fail("retrieved doc with attachment by " + url + " with Header 'Accept: applicatio/json' successfully")
//                        t.end()
//                    }
                })
            })
        })
    })
})


// start sync gateway
test("start syncgateway", function(t){
  common.launchSG(t, function(_sg){
    sg  = _sg;
    gateway = sg.url;
    t.end();
  });
});


test("setup continuous push and pull from both client database", function(t) {
	  sgdb = sg.db.pax().toString()
	  if (config.provides=="android") sgdb = sgdb.replace("localhost", "10.0.2.2")

	  // sgdb = "http://sync.couchbasecloud.com:4984/guestok64"

	  common.setupPushAndPull(server, dbs[0], sgdb, function(err, ok){
	      t.end()
	  })
	})



test("multi inline attachments", test_conf, function(t){

 common.updateDBDocs(t, {numdocs : numDocs, numrevs : 5, dbs : dbs, docgen : 'inlinePngtBigAtt'}, 'emits-updated')

  ee.once('emits-updated', function(e, js){

    t.false(e, "added attachment to docs failed with exception:" + JSON.stringify(e))

    // get doc
    coax([server, dbs[0], "_all_docs", {limit : 1}], function(e, js){

      if(e){
        console.log(e)
        var url = coax([server, dbs[0], "_all_docs", {limit : 1}]).pax().toString()
        t.fail("unable to retrieve doc from all_docs via " + url +": " + JSON.stringify(e))
      }

      // get doc with attachment info
      var docid = js.rows[0].id
      coax([server, dbs[0], docid, { attachments : true }], function(e, js){
        if(e){
          t.fail("read doc failed with exception:" + JSON.stringify(e))
        }

        // verify text attachment
        var attchid = Object.keys(js._attachments)[1] // we expect 2 attachments per doc here
        coax([server, dbs[0], docid, attchid], function(err, response){
        	t.end()
//            var url = coax([server, dbs[0], docid, attchid]).pax().toString()
//            if (err) {
//                t.equals(JSON.stringify(err), JSON.stringify({
//                        "status": 406,
//                        "error": "not_acceptable"
//                    }),
//                    "status is not correct: " + JSON.stringify(err))
//                var options = {
//                    host: config.LocalListenerIP,
//                    port: port,
//                    path: dbs[0] + '/' + docid + "/" + attchid,
//                    method: 'GET',
//                }
//                common.http_get_api(t, options, 200, function (callback) {
//                    t.equals(callback, "Inline text string created by cblite functional test");
//                    t.end()
//                })
//            } else {
//                t.fail("retrieved doc with attachment by " + url + " with Header 'Accept: applicatio/json' successfully")
//                t.end()
//            }
        })
      })
    })

  })
})


/*
test("done", function (t) {
    common.cleanup(t, function (json) {
        t.end();
    });
});*/
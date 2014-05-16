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
if (config.provides=="android") {
	//to decrease number of failures for
	//https://github.com/couchbase/couchbase-lite-android/issues/261
	numDocs = 1;
}

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

test("load databases with large JSON ~4MB", test_conf, function (t) {
    common.createDBDocs(t, {
        numdocs: numDocs,
        dbs: dbs,
        docgen: 'inlineTextLargeJSON'
    }, 'emits-created');

    ee.once('emits-created', function (e, js) {
        t.false(e, "created basic local docs with large JSON ~4MB");

        // get doc
        coax([server, dbs[0], dbs[0] + "_0"], function (e, js) {

            if (e) {
                console.log(e);
                t.fail("unable to retrieve doc wiht large json: " + dbs[0] + "/" + dbs[0] + "_0");
                t.end()
            } else {

                var docid = js._id;
                coax([server, dbs[0], docid, {
                    attachments: true,
                }], function (e, js) {

                    if (e) {
                        console.log(e);
                        t.fail("read doc with large json data");
                    }

                    var docdata = js.jsooooon;
                    if (docdata == undefined) {
                        t.fail("unable to get large json data from doc")
                        t.end();
                    } else {
                        t.equals(docdata.length, 4000000 - 1);
                        t.equals(docdata, (new Array(4000000)).join("x"));
                        t.end();
                    }
                });
            }
        });

    });
});

test("done", function (t) {
    common.cleanup(t, function (json) {
        t.end();
    });
});
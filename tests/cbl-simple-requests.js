var launcher = require("../lib/launcher"),
    coax = require("coax"),
    async = require("async"),
    common = require("../tests/common"),
    conf_file = process.env.CONF_FILE || 'local',
    config = require('../config/' + conf_file),
    utils = common.utils,
    ee = common.ee,
    test = require("tap").test,
    test_time = process.env.TAP_TIMEOUT || 30,
    test_conf = {
        timeout: test_time * 1000
    },
    port = config.LiteServPort,
    host = "127.0.0.1";


var server,
    dbs = ["simple-requests"];

var numDocs = parseInt(config.numDocs) || 100;

// start client endpoint
test("start test client", function (t) {
    common.launchClient(t, function (_server) {
        server = _server;
        t.end();
    });
});

test("create test databases", function (t) {
    common.createDBs(t, dbs);
});
/*
 * https://github.com/couchbase/couchbase-lite-java-core/issues/107
 * $ curl -X PUT http://127.0.0.1:59851/simple-requests/foo4 -d 'STRING' -H "Content-Type: text/html" 
 * {
 * 	"status" : 406,
 * 	"error" : "not_acceptable"
 * }
 * $ curl -X PUT http://127.0.0.1:8081/simple-requests/foo4 -d 'STRING' -H "Content-Type: text/html" 
 * {"error":"not_found","reason":"Router unable to route request to do_PUT_Documentjava.lang.reflect.InvocationTargetException"}

test("try to create json doc without 'Content-Type'", function (t) {
    var post_data = 'STR';
    var options = {
        host: host,
        port: port,
        path: "/" + dbs[0] + "/foo",
        method: 'PUT',
        headers: {
            'Content-Type': 'text/html'
        }
    };
    console.log(options);
    common.http_post_api(t, post_data, options, 406, function (callback) {t.end()});
});
*/
/*
 * https://github.com/couchbase/couchbase-lite-java-core/issues/107
 * $curl -X PUT http://127.0.0.1:8081/simple-requests/foo2 -d 'STRING' -H "Content-Type: application/json" 
 * {"error":"not_found","reason":"Router unable to route request to do_PUT_Documentjava.lang.reflect.InvocationTargetException"}
 * $curl -X PUT http://127.0.0.1:59851/simple-requests/foo2 -d 'STRING' -H "Content-Type: application/json" 
 * {
 *   "status" : 502,
 *   "error" : "Invalid response from remote replication server"
 * }

test("try to create json doc without 'Content-Type'", function (t) {
    var post_data = 'STR';
    var options = {
        host: host,
        port: port,
        path: "/" + dbs[0] + "/foo2",
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        }
    };
    console.log(options);
    common.http_post_api(t, post_data, options, 502, function (callback) {t.end()});
});
*/

/*
 * https://github.com/couchbase/couchbase-lite-java-core/issues/107
 * $curl -X PUT http://127.0.0.1:8081/simple-requests/foo3 -d '{"count":1}' -H "Content-Type: text/html" 
 * {"id":"foo","rev":"1-9483947665d3ac2e389c6c7a14848f82","ok":true}
 * $curl -X PUT http://127.0.0.1:59851/simple-requests/foo3 -d '{"count":1}' -H "Content-Type: text/html" 
 * {
 *   "status" : 406,
 *   "error" : "not_acceptable"
 * }

test("try to create json doc without 'Content-Type'", function (t) {
    var post_data = '{"count":1}';
    var options = {
        host: host,
        port: port,
        path: "/" + dbs[0] + "/foo3",
        method: 'PUT',
        headers: {
            'Content-Type': 'text/html'
        }
    };
    common.http_post_api(t, post_data, options, 406, function (callback) {t.end()});
});
*/

test("done", function(t){
	  common.cleanup(t, function(json){
	    t.end()
	  })
	})
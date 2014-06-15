var launcher = require("../lib/launcher"),
  ini = require("ini"),
  fs = require("fs"),
  coax = require("coax"),
  async = require("async"),
  tstart = process.hrtime(),
  common = require("../tests/common"),
  conf_file = process.env.CONF_FILE || 'local',
  config = require('../config/' + conf_file),
  util =  require("util"),
  eventEmitter = common.ee,
  emitsdefault  = "default",
  test = require("tap").test;

var numDocs=(parseInt(config.numDocs) || 100)*5;



var ini_file_config = ini.parse(fs.readFileSync("config/clusters/cluster.ini", "utf-8"));

var user=ini_file_config.global.rest_username;
var password=ini_file_config.global.rest_password;
var	port = ini_file_config.global.port;
var	servers = ini_file_config.servers;
var	bucket = ini_file_config.bucket.bucket1;
	


var server, sg1, sg2, sg2, sgdb
  // local dbs
 dbs = ["mismatch-gateways-one-rebalancein", "mismatch-test-two-rebalancein"];


/*better to use the pre-created db bucket
  test(
		"create bucket",
		function(t) {
			var post_data = "name="
					+ bucket
					+ "&parallelDBAndViewCompaction=false&autoCompactionDefined=false&threadsNumber=3&replicaIndex=0&replicaNumber=1&saslPassword=&authType=sasl&ramQuotaMB=200&bucketType=membase&flushEnabled=1";
			var options = {
				host : servers.vm1,
				port : port,
				path : '/pools/default/buckets',
				method : 'POST',
				auth : user + ":" + password,
				headers : {
					'Content-Type' : 'application/x-www-form-urlencoded',
					'Content-Length' : post_data.length
				}
			}

			common.http_post_api(t, post_data, options, expectedStatus, function(callback) {
				t.end()
			})

		})
*/

		
/*test("rebalance in node", function(t) {
	var post_data = "hostname=" + servers.vm2 + "&user=" + user + "&password="
			+ password;
	var options = {
		host : servers.vm1,
		port : port,
		path : '/controller/addNode',
		method : 'POST',
		auth : user + ":" + password,
		headers : {
			'Content-Type' : 'application/x-www-form-urlencoded',
			'Content-Length' : post_data.length
		}
	}

	common.http_post_api(t, post_data, options, expectedStatus, function(callback) {
		post_data = "ejectedNodes=&knownNodes=ns_1@" + servers.vm1 + ",ns_1@"
				+ servers.vm2;
		options.path = "/controller/rebalance"
		common.http_post_api(t, post_data, options, expectedStatus, function(callback) {
			setTimeout(function() {
			}, 10000);
			t.end()
		})
	})
})*/
		
		
		
// start client endpoint
test("start test client", function(t){
  common.launchClient(t, function(_server){
    server = _server
    t.end()
  })
})

// start sync gateway
test("start syncgateway", function(t){
  common.launchSGWithParams(t, 9888, config.DbUrl, config.DbBucket, function(_sg1){
    sg1  = _sg1
    t.end()
  })
})

// start sync gateway2
test("start syncgateway", function(t){
  common.launchSGWithParams(t, 9890, config.DbUrl, config.DbBucket, function(_sg2){
    sg2  = _sg2
    t.end()
  })
})

// create all dbs
test("create test databases", function(t){
  common.createDBs(t, dbs)
  sgdb1 = sg1.db.pax().toString()
  sgdb2 = sg2.db.pax().toString()
  })


test("setup continuous push and pull from both client database", function(t) {
	  if (config.provides=="android"){
		  sgdb1 = sgdb1.replace("localhost", "10.0.2.2")
		  sgdb2 = sgdb2.replace("localhost", "10.0.2.2")
	  }

  common.setupPushAndPull(server, dbs[0], sgdb1, function(err, ok){
    t.false(err, 'replication one ok')
    common.setupPushAndPull(server, dbs[1], sgdb2, function(err, ok){
      t.false(err, 'replication two ok')
      t.end()
    })
  })
})

test("setup continuous push and pull from both client database", function(t) {
  common.setupPushAndPull(server, sgdb1, dbs[1], function(err, ok){
    t.false(err, 'replication one ok')
    common.setupPushAndPull(server, sgdb2, dbs[0], function(err, ok){
      t.false(err, 'replication two ok')
      t.end()
    })
  })
  if (config.provides=="android"){
   sgdb1 = sg1.db.pax().toString()
   sgdb2 = sg2.db.pax().toString()
  }
})

test("load databases", function(t){
  t.equals(numDocs/2, Math.floor(numDocs/2), "numDocs must be an even number")
  common.createDBDocs(t, {numdocs : numDocs/2, dbs : dbs, docgen : "channels"})
})

test("verify dbs have same number of docs", {timeout: 300 * 1000}, function(t) {
  common.verifyNumDocs(t, dbs, numDocs)
})

var sg_doc_ids;

test("verify sync gateway changes feed has all docs in it", {timeout: 120 * 1000}, function(t) {
  var db = coax(sgdb1)

  db("_changes", function (err, data) {
    var changes = data.results.map(function(r){return r.id});
    db("_all_docs", function(err, view){
      var docs = view.rows;
      var missing = [];

      docs.forEach(function(d){
        if (changes.indexOf(d.id) == -1) {
          missing.push(d.id)
        }
      })

      var changeIds = {}, dupIds = [];
      var changeSeqs = {}, dupSeqs = [];

      data.results.forEach(function(r){
        if (changeIds[r.id]) {
          dupIds.push(r.id)
        }
        changeIds[r.id] = true

        if (changeSeqs[r.seq]) {
          dupSeqs.push(r.seq)
        }
        changeSeqs[r.seq] = true
      })

      t.equals(docs.length, numDocs, "correct number of docs in _all_docs:" + docs.length )
      t.equals(changes.length, numDocs, "correct number of docs in _changes:" + changes.length)
      t.equals(dupIds.length, 0, "duplicate ids in changes:"+ dupIds.length)
      t.equals(dupSeqs.length, 0, "duplicate seqs in changes:" + dupSeqs.length)
      t.equals(missing.length, 0, "missing changes:" + missing.length)

      console.log("missing "+missing.length+", ids:", missing.join(', '))
      console.log("duplicate change ids "+dupIds.length+", ids:", dupIds.join(', '))
      console.log("duplicate change seqs "+dupSeqs.length+", seqs:", dupSeqs.join(', '))

      t.end()
    })

  })

})

test("verify cbl changes", function(t){
	common.verifyChanges(coax([server, dbs[0]]), function(db_one_ids, db_one_dup_ids, db_one_seqs,db_one_dup_seqs) {
    var one_ids_list = Object.keys(db_one_ids), db_one_seqs_list = Object.keys(db_one_seqs)
    t.equals(one_ids_list.length, numDocs, "correct number of docs in _all_docs")
    t.equals(db_one_seqs_list.length, numDocs, "correct number of docs in _changes")
    t.equals(db_one_dup_ids.length, 0, "duplicate ids in changes "+db_one_dup_ids)
    t.equals(db_one_dup_seqs.length, 0, "duplicate seqs in changes")

    common.verifyChanges(coax([server, dbs[0]]), function(db_two_ids, db_two_dup_ids, db_two_seqs,db_two_dup_seqs) {
      var db_two_idslist = Object.keys(db_two_ids), db_two_seqs_list = Object.keys(db_two_seqs)

      t.equals(db_two_idslist.length, numDocs, "correct number of docs in _all_docs")
      t.equals(db_two_seqs_list.length, numDocs, "correct number of docs in _changes")
      t.equals(db_two_dup_ids.length, 0, "duplicate ids in changes")
      t.equals(db_two_dup_seqs.length, 0, "duplicate seqs in changes")

      var missing_from_one =[], missing_from_two=[]
      for (var i = db_two_idslist.length - 1; i >= 0; i--) {
        if (!db_one_ids[db_two_idslist[i]]) {
          missing_from_one.push(db_two_idslist[i])
        }
      };
      for (var i = one_ids_list.length - 1; i >= 0; i--) {
        if (!db_two_ids[one_ids_list[i]]) {
          missing_from_two.push(one_ids_list[i])
        }
      };
      t.equals(0, missing_from_one.length, "missing changes in one "+missing_from_one.join())
      t.equals(0, missing_from_two.length, "missing changes in two"+missing_from_two.join())
      t.end()
    })
  })
})

//TODO need wait while rebalance in completed, then flush/or recreate bucket and rebalance out

test("cleanup cb bucket", function(t){
    if (config.DbUrl.indexOf("http") > -1){
    coax.post([config.DbUrl + "/pools/default/buckets/" + config.DbBucket + "/controller/doFlush"],
	    {"auth":{"passwordCredentials":{"username":"Administrator", "password":"password"}}}, function (err, js){
	      t.false(err, "flush cb bucket")
	    })
	}
    t.end()
})

test("done", function(t){
  common.cleanup(t, function(json){
    sg1.kill()
    sg2.kill()
    t.end()
  })
})
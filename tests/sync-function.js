var launcher = require("../lib/launcher"),
  coax = require("coax"),
  config = require("../config/local.js"),
  test = require("tap").test;

var serve, port = 8888, server = "http://localhost:"+port+"/", adminUrl = "http://localhost:"+(port+1)+"/"

test("can launch a Sync Gateway", function(t) {
  serve = launcher.launchSyncGateway({
    port : port,
    dir : __dirname+"/../tmp/syncfun",
    path : config.SyncGatewayPath,
    configPath : config.SyncGatewaySyncFunctionTest
  })
  serve.once("ready", function(err){
    t.false(err, "no error, Sync Gateway running on our port")
    coax(server, function(err, ok){
      t.false(err, "no error, Sync Gateway reachable")
      coax(adminUrl, function(err, ok) {
        t.false(err, "no error, admin port reachable")
        t.end()
      })
    })
  });
});
var adminDb;
var userUrl;
test("create users", function(t){
  adminDb = coax([adminUrl, "db"])
  var users = {
    "coolio" : {"password":"coolio", "admin_channels" : ["voyage"]},
    "norm" : {"password":"norm", "admin_channels" : ["etc"]},
  }
  adminDb.put(["_user",'coolio'], users.coolio, function(err, ok) {
    t.false(err, "no error, set user coolio")
    userUrl = "http://coolio:coolio@localhost:"+port+"/"
    adminDb.put(["_user",'norm'], users.norm, function(err, ok) {
      t.false(err, "no error, set user norm")
      normUrl = "http://norm:norm@localhost:"+port+"/"
      t.end()
    })
  })
})

test("can get db info", function(t){
  coax([userUrl, "db"]).get(function(err, ok){
    t.ok(ok, "created database")
    t.equals(ok.db_name, "db", "correct name")
    coax([normUrl, "db"]).get(function(err, ok){
      t.ok(ok, "created database")
      t.equals(ok.db_name, "db", "correct name")
      t.end()
    })
  })
})

test("requireAccess coolio user", function(t){
  // can't write to channels you can't acccess
  var doc = {channels:["norm-will-make"]}
  coax.put([userUrl, "db", "normsdoc10"], doc, function(err, ok){
    console.log("put1 for coolio user", err)
    t.ok(err, "shouldn't allow write when channels are not granted for the user")

    //coolio can't write with doc.subscribe = "norm"
    doc.subscribe = "norm"
    coax.put([userUrl, "db", "normsdoc11"], doc, function(err, ok){
      console.log("put2 for coolio user", err)
      t.ok(err, "shouldn't allow write")
      // resave to grant norm access to the channel
      doc.subscribe = "coolio"
      coax.put([userUrl, "db", "normsdoc12"], doc, function(err, ok){
        console.log("put3 for coolio use", err)
        t.false(err, "should allow write")
        doc2 = {channels:["norm-will-make"]}
        coax.put([userUrl, "db", "normsdoc13"], doc2, function(err, ok){
            console.log("put4 for coolio user", err)
            t.ok(err, "shouldn't still allow write when channels are not granted for the user coolio")
        t.end()
        })
      })
    })
   })
  })

test("requireAccess norm user", function(t){
  // can't write to channels you can't acccess
  var doc ={channels:["norm-will-make"]}, doc1 = {channels:["norm-will-make"]}
  coax.put([normUrl, "db", "normsdoc"], doc, function(err, ok){
    console.log("put1 for norm user", err)
    t.ok(err, "shouldn't allow write when channels are not granted for the user")

    coax.put([normUrl, "db", "normsdoc2"], doc, function(err, ok){
    console.log("put2 for norm user", err)
    t.ok(err, "shouldn't allow write another doc when channels are not granted for the user")

    // resave to grant norm access to the channel
    doc.subscribe = "norm"
    coax.put([normUrl, "db", "normsdoc"], doc, function(err, ok){
      console.log("put3 for norm user", err)
      t.false(err, "should allow write")
      // try to write to channels you can't access by channels after success
		// writing by subscribes
	coax.put([normUrl, "db", "normsdoc2"], doc1, function(err, ok){
        console.log("put4 for norm user", err)
        t.ok(err, "shouldn't still allow write when channels are not granted for the norm user")
        t.end()
      })
    })
   })
  })
})

test("requireAccess mixed users", function(t){
  // can write to channels you can acccess
  var doc = {channels:["voyage"]}
  coax.put([userUrl, "db", "cooliosdoc30"], doc, function(err, ok){
    console.log("put1 for coolio user", err)
    t.false(err, "should allow write when channels are granted for the user")

    // norm user can't write with channels:["voyage"]
    coax.put([normUrl, "db", "normsdoc31"], doc, function(err, ok){
      console.log("put2 for norm user", err)
      t.ok(err, "shouldn't allow write")

      doc.subscribe = "coolio"
      coax.put([normUrl, "db", "normsdoc32"], doc, function(err, ok){
        console.log("put3 for norm user", err)
        t.ok(err, "shouldn't allow user write with someone else's channel")

        coax.put([userUrl, "db", "cooliosdoc33"], doc, function(err, ok){
            console.log("put4 for coolio user", err)
            t.false(err, "should still allow write when channels are granted for the user coolio")
        t.end()
        })
      })
    })
   })
  })

  test("requireAccess, doc with some channels", function(t){
  // can write to channels you can acccess
  var doc = {channels:["new", "voyage", "etc"]}
  coax.put([userUrl, "db", "cooliosdoc40"], doc, function(err, ok){
    console.log("put1 for coolio user", err)
    t.false(err, "should allow write when channels are granted for the user")

    // norm user can't write with channels:["voyage"]
    coax.put([normUrl, "db", "normsdoc41"], doc, function(err, ok){
      console.log("put2 for norm user that contains voyage channel", err)
      t.ok(err, "shouldn't allow write")

      doc.subscribe = "norm"
      coax.put([normUrl, "db", "normsdoc42"], doc, function(err, ok){
        console.log("put2 for norm user, doc contains voyage/etc channels but already has subscribe=norm", err)
        t.ok(err, "shouldn't allow user write with someone else's channel")
        coax.put([userUrl, "db", "cooliosdoc43"], doc, function(err, ok){
            console.log("put4 for coolio user, doc contain voyage channel but wrong doc.subscribe", err)
            t.ok(err, "shouldn't still allow write when doc.subscribe!=user")
            doc.subscribe = "coolio"
            coax.put([userUrl, "db", "cooliosdoc43"], doc, function(err, ok){
        	console.log("put4 for coolio user, doc contain voyage channel but wrong doc.subscribe", err)
        	t.false(err, "should still allow write when channels are granted for the user coolio")
        	t.end()
          })
        })
      })
    })
   })
  })

// 137 Exception in JS sync function when put empty doc for requireAccess tests
test("requireAccess, put empty doc", function(t){
  // try to put empty doc for coolio user
  var doc = {}
  coax.put([userUrl, "db", "cooliosdoc50"], doc, function(err, ok){
    console.log("put1 for coolio user", err)
    t.ok(err, "shouldn't allow write empty doc(without any grands")
	t.ok(err.error=='Forbidden', "wrong error responce for empty doc, expected:{ error: 'Forbidden', reason: 'wrong user' }")
	t.end()
   })
  })

test("requireAccess, update/delete doc", function(t){
      // can write to channels you can acccess
    var expError={ error: 'conflict', reason: 'Document exists'}
    var doc = {channels:["voyage"]}
    coax.put([userUrl, "db", "doc60"],doc, function(err, ok){
	console.log("put1 for coolio user", err)
	t.false(err,"should allow write when channels are granted for the user")
	var doc2 ={channels:["etc"]}
	doc.subscribe = "norm"
	coax.put([normUrl, "db","doc60"], doc2, function(err, ok){
	    console.log("put2 for norm user", err)
	    t.ok(err, "shouldn't allow rewrite with other access")
	    if (err.error !=expError.error || err.reason != expError.reason){
		t.fail("wrong response whe try to update a doc with other privileges")
		}
	    coax.put([userUrl, "db", "doc60"], doc, function(err, ok){
		console.log("update doc with coolio user", err)
		t.false(err, "should allow user to updatedoc")

		coax.put([normUrl, "db", "doc60"], doc2, function(err, ok){
		    console.log("put3 for norm user", err)
		    t.ok(err, "shouldn't allow rewrite with other access")
		    if (err.error != expError.error || err.reason != expError.reason){
			t.fail("wrong respnse when try to update a doc with other privileges")
			}
		    coax.del([userUrl, "db", "doc60"], function(err, ok){
			console.log("delete with coolio user", err)
			t.false(err, "should allow delete document")
			t.end()
		    })
		})
	    })
	})
    })
  })

test("exit", function(t) {
  serve.kill()
  t.end()
})

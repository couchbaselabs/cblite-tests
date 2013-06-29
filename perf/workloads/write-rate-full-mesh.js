var coax = require("coax"),
  async = require("async"),
  statr = require("../../lib/statr")

// This is a workload you run on a phalanx of clients and a server.
// (The "server" could be an http load balancer in front of a Sync Gateway
// cluster in front of a Couchbase Server cluster)

// You pass in the clients and server, so it's up to you create and destroy them.

// write-rate-w-channels is more realistic

module.exports = function(t, clients, server, delay, RUNSECONDS, done) {
  console.log("writeRateFullMesh", server, clients)
  // we can assume client are all both pushing and pulling from the server
  // every client should see every write
  // so an interesting question is, how fast can you make the per-client write rate,
  // before end-to-end latencies start growing?
  var changes, mystatr = statr()

  t.test("spin up a writer for each client", function(t) {
    clients.forEach(function(url){
      createWriter(url, delay)
    })
    t.end()
  })

  t.test("listen to the changes feed on a single client", function(t){
    //  (could expand the sample to 1% of clients)
    changes = coax(clients[0]).changes({feed : "continuous"}, function(){})
    changes.once("data", function(){
      t.end()
    })
  })

  t.test('measure latencies coming off one client\'s changes feed', function(t){
    // t.end()
    changes.on("data", function(data){
        try {
          var json = JSON.parse(data.toString())
        } catch(e) {}
        if (json) changes.emit("json",json)
    })
    changes.on("json", function(json){
      var gotch = new Date()
      coax([clients[0], json.id], function(err, doc) {
        mystatr.stat("change", (gotch-new Date(doc.at)))
        mystatr.stat("doc", (new Date()-new Date(doc.at)))
        console.log("took "+(gotch-new Date(doc.at))+" milliseconds to see doc "+json.id)
      })
    })
    setTimeout(t.end.bind(t), RUNSECONDS * 1000)
  })

  t.test("close", function(t){
    writersRunning = false;
    console.log("stats", mystatr.summary())
    // console.log("changes", changes)
    t.end()
  })

  done()

}
var writersRunning = true;
function createWriter(url, delay) {
  var db = coax(url);
  var writer = setTimeout(function() {
    // console.log("post", url)
    db.post({at : new Date(), on : url}, function(){
      if (writersRunning) createWriter(url, delay) // set timeout + POST response time
    })
  }, Math.floor((delay/2) + (Math.random()*(delay/2))))
}

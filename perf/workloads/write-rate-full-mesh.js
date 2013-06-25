var coax = require("coax"),
  async = require("async")

// This is a workload you run on a phalanx of clients and a server.
// (The "server" could be an http load balancer in front of a Sync Gateway
// cluster in front of a Couchbase Server cluster)

// You pass in the clients and server, so it's up to you create and destroy them.

// write-rate-w-channels is more realistic

module.exports = function(t, clients, server, delay, done) {
  console.log("writeRateFullMesh", server, clients)
  // we can assume client are all both pushing and pulling from the server
  // every client should see every write
  // so an interesting question is, how fast can you make the per-client write rate,
  // before end-to-end latencies start growing?
  var changes

  t.test("spin up a writer for each client", function(t) {
    clients.forEach(function(url){
      createWriter(url, delay)
    })
    t.end()
  })

  t.test("listen to the changes feed on a client", function(t){
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
      var got = new Date()
      coax([clients[0], json.id], function(err, doc) {
        console.log("took "+(got-new Date(doc.at))+" milliseconds to see doc "+json.id)
      })
    })
  })

  t.test("close", function(t){
    writerRunning = false;
    t.end()
  })

  done()

}
var writerRunning = true;
function createWriter(url, delay) {
  var db = coax(url);
  var writer = setTimeout(function() {
    // console.log("post", url)
    db.post({at : new Date(), on : url}, function(){})
    if (writerRunning) createWriter(url, delay)
  }, Math.floor((delay/2) + (Math.random()*(delay/2))))
}

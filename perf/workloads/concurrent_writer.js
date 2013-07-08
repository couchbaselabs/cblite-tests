var coax = require("coax"),
  async = require("async"),
  loop = require("nodeload/lib/loop"),
  statr = require("../../lib/statr"),
  running = false
  writer_index = 0

module.exports = function(t, clients, server, perf, done) {

  console.log("writeConcurrentLoader", server, clients)

  var delay = perf.clientWriteDelay
  var RUNSECONDS = perf.runSeconds
  var mystatr = statr()
  var changes, writers, pull_client = clients[0]

  console.log("Pull client "+pull_client)

  t.test("start writers", function(t){

     if(clients.length > 1){
      clients = clients.splice(1,clients.length)
     }
     async.map(clients, function(client, cb){
       writer = startWriter(client, perf)
       cb(null, writer)
     }, function(err, result){
       writers = result
       t.false(err, "started "+result.length+"writers")
       t.end()
     })

  })

  t.test('measure latencies coming off one client\'s changes feed',
    {timeout : perf.runSeconds*10000},
    function(t){
      writers[0].on('end', function() {
        running = false
        console.log("writer done")
        writer.removeAllListeners()
        t.end()
      })
      changes = coax(pull_client).changes({feed : "continuous"}, function(){})
      changes.on("data", function(data){
        if(running){
            try {
              var json = JSON.parse(data.toString())
            } catch(e) {}
            if (json) changes.emit("json",json)
        }
      })
      changes.on("json", function(json){
        if(running){
          var gotch = new Date()
          coax([pull_client, json.id], function(err, doc) {
            // record how long it took to receive doc from another client //
            if(doc.on != pull_client){
              mystatr.stat("change", (gotch-new Date(doc.at)))
              mystatr.stat("doc", (new Date()-new Date(doc.at)))
              console.log("took "+(gotch-new Date(doc.at))+" milliseconds to see doc "+json.id)
            }
          })
        }
      })
  })

  t.test("print stats", function(t){
      console.log("stats", mystatr.summary())
      t.end()
      done()
   })


}


function startWriter(client, perf){

  running = true
  var i = 0, start = new Date(), lasttime = start,
  writer = new loop.Loop({
      fun: function(finished) {
            url = client
            var db = coax(url);
            doc={at : new Date(), on : url}
            db.post(doc, function(err, json){
                if (err != null){
                  console.log("ERROR: "+err)
                }
                var now = new Date();
                lasttime = now;
                i++;
                finished();
             })
      },
      rps: perf.requestsPerSec, // times per second (every 200ms)
      duration: perf.runSeconds, // second
  }).start();

  return writer
}

var coax = require("coax"),
  async = require("async"),
  loop = require("nodeload/lib/loop"),
  statr = require("../../lib/statr"),
  running = false
  writer_index = 0
  doc_map = {}

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
       doc_map[client] = 0
       writer = startWriter(client, perf)
       cb(null, writer)
     }, function(err, result){
       writers = result
       t.false(err, "started "+result.length+" writers")
       t.end()
     })

  })

  t.test('measure latencies coming off one client\'s changes feed',
    {timeout : perf.runSeconds*10000},
    function(t){

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
            if(doc && doc.on != pull_client){
              mystatr.stat("change", (gotch-new Date(doc.at)))
              mystatr.stat("doc", (new Date()-new Date(doc.at)))
              console.log("took "+(gotch-new Date(doc.at))+" milliseconds to see doc "+json.id)
            }
          })
        }
      })

    /* wait for all writers to finish */
    async.map(writers, function(writer, cb){
      writer.on('end', function(){
          cb(null, {ok : "done"})
      })
    }, function(err, result){
        /* verify gateway and every client has total # of docs written */
        var total_docs = 0
        for (var key in doc_map){
          console.log(key+"->"+doc_map[key])
          total_docs = total_docs + doc_map[key]
        }

        // gateway
        setTimeout(
          function(){
            coax([server], function(err, doc) {

              t.false(err, "got gateway docs")
              if (doc && 'doc_count' in doc){
                t.false(doc.doc_count < total_docs, "all documents replicated")
              } else {
                t.fail("unable to retrieve doc count")
              }
          })
          }, 5000)

          // clients
          async.map(clients, function(client, cb){
            var client_docs = 0
            var retry = 0
            async.whilst(
              function() {
                if (retry < 120){
                  return client_docs < total_docs
                } else {
                  return false
                }
               },
              function(err_cb) {
                /* query doc count every second */
                setTimeout( function(){
                              coax([client], function(err, doc) {
                                        client_docs = doc.doc_count
                                        retry = retry + 1
                                        err_cb(null)
                              })
                }, 1000)
               },
              function(err){
                  t.false(client_docs < total_docs, client +"  has "+ client_docs+" docs")
                  cb(null, 'ok')
              })
          }, function(err, result){
            t.false(err, 'ok')
            t.end()
          });
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
                doc_map[client] = i
                i++;
                finished();
             })
      },
      rps: perf.requestsPerSec, // times per second (every 200ms)
      duration: perf.runSeconds, // second
  }).start();

  return writer
}

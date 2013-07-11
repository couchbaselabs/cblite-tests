var coax = require("coax"),
  async = require("async"),
  loop = require("nodeload/lib/loop"),
  statr = require("../../lib/statr"),
  running = false
  writer_index = 0
  doc_map = {}

function startWriters(){

}


module.exports = function(clients, server, perf, done) {

  console.log("writeConcurrentLoader", server, clients)

  var delay = perf.clientWriteDelay
  var RUNSECONDS = perf.runSeconds
  var mystatr = statr()
  var changes, writers, pull_client = clients[0]

  console.log("Pull client "+pull_client)

  if(clients.length > 1){
   clients = clients.splice(1,clients.length)
  }
  console.log(clients)

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
          //console.log("took "+(gotch-new Date(doc.at))+" milliseconds to see doc "+json.id)
        }
      })
    }
  })

  async.map(clients, function(client, cb){
    doc_map[client] = 0
    writer = startWriter(client, perf)
    cb(null, writer)
  }, function(err, result){
    writers = result

    /* wait for all writers to finish */
    async.map(writers, function(writer, cb){
      writer.on('end', function(){
          cb(null, {ok : "done"})
      })
    }, function(err, result)
      {
        console.log("writers done")
        /* verify gateway and every client has total # of docs written */
        var total_docs = 0
        for (var key in doc_map){
          console.log(key+" created ->"+doc_map[key])
          total_docs = total_docs + doc_map[key]
        }


          // clients
          async.map(clients, function(client, cb){
            var retry = 0
            async.whilst(
              function() {
                if (retry < 300){
                  return doc_map[client]< total_docs
                } else {
                  console.log(client+" timed out")
                  return false
                }
               },
              function(err_cb) {
                /* query doc count every second */
                setTimeout( function(){
                              coax([client], function(err, doc) {
                                        doc_map[client] = doc.doc_count
                                        retry = retry + 1
                                        err_cb(null)
                              })
                }, 1000)
               },
              function(err){
                  console.log( client +" finished with "+ doc_map[client]+"/"+total_docs+" total docs")
                  cb(null, 'ok')
              })
          }, function(err, result){
            console.log("stats", mystatr.summary())
            console.log("pull client: "+clients[0]+" has "+doc_map[clients[0]]+' of total_docs='+total_docs+' docs pulled')
            done()
          });
    })

  })


}


function startWriter(client, perf){

  running = true
  var url = client
  var db = coax(url)
  var i = 0,
  writer = new loop.Loop({
      fun: function(finished) {
            db.post({at : new Date(), on : url}, function(err, json){
                if (err != null){
                  console.log("ERROR: "+err)
                }
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

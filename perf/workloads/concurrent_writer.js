var coax = require("coax"),
  async = require("async"),
  loop = require("nodeload/lib/loop"),
  statr = require("../../lib/statr"),
  writer_index = 0
  perf_running = true
  mystatr = statr()
  total_reads = total_writes = 0
  doc_map = {}


module.exports = function(clients, server, perf, done) {

  console.log("writeConcurrentLoader", server, clients)

  var delay = perf.clientWriteDelay
  var RUNSECONDS = perf.runSeconds
  var changes, writers, pull_client = clients[0]
  statCheckPointer()

  console.log("Pull client "+pull_client)

  if(clients.length > 1){
   clients = clients.splice(1,clients.length)
  }
  console.log(clients)

  changes = coax(pull_client).changes({feed : "continuous"}, function(){})
  changes.on("data", function(data){
      try {
        var json = JSON.parse(data.toString())
        changes.emit("json",json)
      } catch(e) {}
  })

  changes.on("json", function(json){
      var gotch = new Date()
      coax([pull_client, json.id], function(err, doc) {
        // record how long it took to receive doc from another client //
        if(doc && doc.on != pull_client){
          mystatr.stat("change", (gotch-new Date(doc.at)))
          mystatr.stat("doc", (new Date()-new Date(doc.at)))
        }
      })
  })

  async.map(clients, function(client, cb){
    writer = startReaderWriter(client, perf)
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
        /* verify every client has total # of docs written */
        var total_docs = 0
        for (var key in doc_map){
          console.log(key+" created ->"+doc_map[key])
          total_docs = total_docs + doc_map[key]
        }
        console.log("total docs ->"+total_docs)

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
                  //console.log( client +" finished with "+ doc_map[client]+"/"+total_docs+" total docs")
                  cb(null, 'ok')
              })
          }, function(err, result){
            console.log("stats", mystatr.summary())
            console.log("pull client: "+clients[0]+" has "+doc_map[clients[0]]+' of total_docs='+total_docs+' docs pulled')
            perf_running = false
            console.log("total reads: "+total_reads+" total_writes: "+total_writes)
            done()
          });
    })

  })


}

function startReaderWriter(client, perf){

  var url = client
  var db = coax(url)
  var loop_counter = 0
  var recent_docs = [] /* keep last 10 known docs around */
  doc_map[client] = 0

  writer = new loop.Loop({
      fun: function(finished) {
            if ((10 - loop_counter%10) > (perf.writeRatio/10)){
               db.post({at : new Date(), on : url}, function(err, json){
                  if (err != null){
                    console.log("ERROR: "+err)
                  }
                  if ('id' in json){
                   if (recent_docs.length > 10){
                     recent_docs.shift()
                    }
                    recent_docs.push(json.id)
                  }
                  doc_map[client] = doc_map[client] + 1
               })
               total_writes++
            }
            if ((10 - loop_counter%10) > (perf.readRatio/10)){
              if(recent_docs.length > 0){
                id = recent_docs[Math.floor(Math.random()*recent_docs.length)]
                coax([url, id], function(err, doc) {
                  if(err){
                    console.log("Error retrieving doc: "+err)
                   }
                })
              }
               total_reads++
            }
            loop_counter++
            finished();
      },
      rps: perf.requestsPerSec, 
      duration: perf.runSeconds,
  }).start();

  return writer
}


function statCheckPointer(){

  async.whilst(
    function() { return perf_running},
    function(cb) {
      setTimeout(function(){
        console.log(mystatr.summary())
        cb(null)
      }, 10000)},
    function(err){} )

}

var coax = require("coax"),
  async = require("async"),
  follow = require("follow"),
  loop = require("nodeload/lib/loop"),
  statr = require("../../lib/statr"),
  writer_index = 0,
  perf_running = true,
  mystatr = statr(),
  doc_map = {},
  start_time = process.hrtime(),
  total_reads = total_writes = total_changes = 0


module.exports = function(clients, server, perf, done) {

  var delay = perf.clientWriteDelay
  var RUNSECONDS = perf.runSeconds
  var changes, writers, pull_client = clients[0]



  /* look for a liteServ to use as pull client */
  async.map(clients, function(url, cb){
    host = url.replace(/(.*:[0-9]+).*/,"$1")
    coax(host, function(err, res){
        if (!err && "CouchbaseLite" in res) {
          pull_client = url
        }
        cb(null)
    })
  }, function(res){

    console.log("Monitoring client = "+pull_client)
    statCheckPointer(server, pull_client)

    follow(pull_client, function(err, json){
      if(!err){
        var gotch = new Date()
        coax([pull_client, json.id], function(err, doc) {
          // record how long it took to receive doc from another client //
          if(doc && doc.on != pull_client){
            mystatr.stat("change", (gotch-new Date(doc.at)))
            mystatr.stat("doc", (new Date()-new Date(doc.at)))
          }
        })
      }

    })

  })

  async.map(clients, function(client, cb){
    writer = startReaderWriter(client, server, perf)
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
          total_docs = total_docs + doc_map[key]
        }
        //console.log("total docs ->"+total_docs)

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

function startReaderWriter(client, server, perf){

  var url = client
  var loop_counter = 0
  var recent_docs = [] /* keep last 10 known docs around */
  doc_map[client] = 0
  var delay  = config.clientWriteDelay

  var ip = url.replace(/[\.,\:,\/]/g,"")
  writer = new loop.Loop({
      fun: function(finished) {
            if ((loop_counter%10) < (perf.writeRatio/10)){
              var d = new Date()
              var ts = String(d.getHours())+d.getMinutes()+d.getSeconds()+d.getMilliseconds()
              var id = "perf"+doc_map[client]+"_"+ip+"_"+ts
              //console.log(id)
              setTimeout(function(){
                coax.put([url,id],
                  {at : new Date(), on : url}, function(err, json){
                    if (err != null){
                      console.log("ERROR Pushing doc to: "+url+" "+id)
                      console.log(err)
                    } else {
                        if ('id' in json){
                         if (recent_docs.length > 10){
                           recent_docs.shift()
                          }
                          recent_docs.push(json.id)
                        }
                        doc_map[client] = doc_map[client] + 1
                        total_writes++
                      }
                 })},  Math.random()*delay)
            }else {
              if ((loop_counter%10) < (perf.readRatio/10)){
                if(recent_docs.length > 0){
                  id = recent_docs[Math.floor(Math.random()*recent_docs.length)]
                  coax([url, id], function(err, doc) {
                    if(err){
                      console.log("Error retrieving doc: "+id)
                     }
                  })
                }
                 total_reads++
              }
            }
            loop_counter++
            finished();
      },
      rps: perf.requestsPerSec,
      duration: perf.runSeconds,
  }).start();

  return writer
}


function statCheckPointer(gateway, pull_client){

  if(perf_running){
      var stat_checkpoint = mystatr.summary()
      console.log("collect stats: "+perf_running)
      coax(pull_client, function (err, json){
        if(!err){
          stat_checkpoint.docs_relayed = json.doc_count
        }

        var ts = process.hrtime(start_time)[0]
        stat_checkpoint.total_changes = total_changes
        stat_checkpoint.elapsed_time = ts
        stat_checkpoint.total_reads = total_reads
        stat_checkpoint.docs_written = total_writes
        console.log(stat_checkpoint)
      })
    setTimeout(function(){
       statCheckPointer(server, pull_client)
       cb(null)
     },30000 )
  }

}

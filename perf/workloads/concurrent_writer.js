var coax = require("coax"),
  async = require("async"),
  follow = require("follow"),
  loop = require("nodeload/lib/loop"),
  statr = require("../../lib/statr"),
  writer_index = 0,
  perf_running = true,
  mystatr = statr(),
  doc_map = {},
  perfdb = null,
  start_time = process.hrtime(),
  est_writes_interval = est_writes = total_reads = total_writes = total_changes = 0

module.exports = function(clients, server, perf, done) {

  var delay = perf.clientWriteDelay
  var RUNSECONDS = perf.runSeconds
  var changes, writers, pull_client = clients[0]
  est_writes = clients.length*(perf.writeRatio/100)*perf.requestsPerSec*perf.runSeconds
  est_writes_interval = clients.length*(perf.writeRatio/100)*perf.requestsPerSec*perf.statInterval

  if ('PerfDB' in perf){
    perfdb = perf.PerfDB
  } else {
    /* use local stat db */
    var port = config.LocalListenerPort + 1
    var adminUrl = "http://"+config.LocalListenerIP+":"+port
    perfdb = coax([adminUrl,"stats"]).pax.toString()
  }

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
    // start stat checkpointer when all writers started
    statCheckPointer(server, pull_client, perf.statInterval, done)
    console.log("started "+result.length+" writers")
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

  writer.on('end', function(){
    console.log("writer finished: "+client)
  })

  return writer
}


function statCheckPointer(gateway, pull_client, statInterval, done){

  setTimeout(function(){
    var stat_checkpoint = mystatr.summary()
    console.log("collect stats")
    coax(pull_client, function (err, json){
      if(!err){
        stat_checkpoint.docs_relayed = json.doc_count

        if(stat_checkpoint.docs_relayed >= Math.floor(est_writes)){
          perf_running = false
        }
      }

      var ts = process.hrtime(start_time)[0]
      stat_checkpoint.total_changes = total_changes
      stat_checkpoint.elapsed_time = ts
      stat_checkpoint.total_reads = total_reads
      stat_checkpoint.docs_written = total_writes
      stat_checkpoint.testid = "perf_"+start_time[0]
      stat_checkpoint.est_writes = est_writes
      stat_checkpoint.est_writes_interval = est_writes_interval
      saveStats(stat_checkpoint)
      console.log(stat_checkpoint)
    })
    if(perf_running){
      statCheckPointer(server, pull_client, statInterval, done)
    } else {
      done()
    }
  }, statInterval*1000)

}

function saveStats(stat_checkpoint){

  var id = stat_checkpoint.testid+"_"+stat_checkpoint.elapsed_time
  coax.put([perfdb, id], stat_checkpoint, function(err, json){
    if(err){
      console.log("Warning! Failed to save stats from checkpoint: "+id)
      console.log(err)
    }
  })

}

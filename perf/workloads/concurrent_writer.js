var coax = require("coax"),
  async = require("async"),
  follow = require("follow"),
  loop = require("nodeload/lib/loop"),
  statr = require("../../lib/statr"),
  writer_index = 0,
  mystatr = statr(),
  doc_map = {},
  perfdb = null,
  start_time = process.hrtime(),
  est_writes_interval = est_writes = total_relayed = total_reads = total_writes = total_changes = 0

module.exports = function(clients, server, perf, done) {

  var delay = perf.clientWriteDelay
  var RUNSECONDS = perf.runSeconds
  var changes, writers, pull_client = clients[0]
  est_writes = clients.length*(perf.writeRatio/100)*perf.requestsPerSec*perf.runSeconds
  est_writes_interval = clients.length*(perf.writeRatio/100)*perf.requestsPerSec*perf.statInterval
  // start writing docs to the gateway
  gatewayWriter(server)

  if ('PerfDB' in perf){
    perfdb = perf.PerfDB
    /* send initial test info */
    var doc = {
      testid : "perf_"+start_time[0],
      numClients : clients.length,
      numGateways : perf.numGateways,
      readRatio : perf.readRatio,
      writeRatio : perf.writeRatio,
      est_writes : est_writes,
      backend : "1 couchbase"  //TODO: get this from gateway?
    }

    var id = doc.testid+"_info"
    coax.put([perfdb, id], doc, function(err, json){
      if(err){
        console.log("Error saving test meta data")
        console.log(err)
      }
    })

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

    // follow gateway changes feed and filter out non pull_client docs
    var sgfeed = new follow.Feed({
      db : server,
      filter : function(doc, req){
        if((doc.on == pull_client) || (doc.on == server)){
            return true
        }
        return false
      }
    })
    sgfeed.follow()
    sgfeed.on('change', function(change){
      var gotch = new Date()
      coax([server, change.id], function(err, doc){
        if(!err){
          if(doc.on == pull_client){
            mystatr.stat("clientsg-change", (gotch-new Date(doc.at)))
            mystatr.stat("clientsg-doc", (new Date()-new Date(doc.at)))
          } else {
            mystatr.stat("directsg-change", (gotch-new Date(doc.at)))
            mystatr.stat("directsg-doc", (new Date()-new Date(doc.at)))
          }
        }
      })
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
               })
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


// every 10s write a doc to gateway
function gatewayWriter(gateway){
  setTimeout(function(){
    var ip = gateway.replace(/[\.,\:,\/]/g,"")
    var id = "perf_"+ip+"_"+process.hrtime(start_time)[0]
    coax.put([gateway,id],
              {at : new Date(), on : gateway}, function(err, json){
              if( err != null){
                console.log("Error: unable to push doc to gateway")
                console.log(err)
              }
     })

     gatewayWriter(gateway)
  }, 10000)

}

function statCheckPointer(gateway, pull_client, statInterval, done){

  setTimeout(function(){
    var stat_checkpoint = mystatr.summary()
    console.log("collect stats: ")
    coax(pull_client, function (err, json){
      if(!err){
        if('doc_count' in json){
          total_relayed = json.doc_count
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
      stat_checkpoint.docs_relayed = total_relayed
      saveStats(stat_checkpoint)
      console.log(stat_checkpoint)
    })

    if(total_relayed >= Math.floor(est_writes)){
        done()
    } else {
      statCheckPointer(gateway, pull_client, statInterval, done)
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

var coax = require("coax"),
  async = require("async"),
  follow = require("follow"),
  loop = require("nodeload/lib/loop"),
  statr = require("../../lib/statr"),
  writer_index = 0,
  mystatr = null,
  doc_map = {},
  perfdb = null,
  start_time = process.hrtime(),
  est_writes_interval = est_writes = total_relayed = total_reads = total_writes = total_changes = 0

module.exports.readerWriter = function(client, server, perf){

  var url = client
  var loop_counter = 0
  var recent_docs = [] /* keep last 10 known docs around */
  doc_map[client] = 0

  var ip = url.replace(/[\.,\:,\/]/g,"")
  writer = new loop.Loop({
      fun: function(finished) {
            if ((loop_counter%10) < (perf.writeRatio/10)){
              // Do a write
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
                // Do a read from recent_docs 
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
      duration: Inifinity,
  }).start();

  return writer
}

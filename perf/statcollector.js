var coax = require("coax"),
  async = require("async"),
  Client = require("request-json").JsonClient,
  follow = require("follow"),
  loop = require("nodeload/lib/loop"),
  conf_file = process.env.CONF_FILE || 'local',
  config = require('../config/' + conf_file),
  statr = require("../lib/statr"),
  writer_index = 0,
  mystatr = null,
  doc_map = {},
  perfdb = null,
  start_time = process.hrtime(),
  testid = null,
  startdt = null,
  last_stat_seq = "stats:0",
  total_relayed =  total_writes =  0;

var running = false,
  cfeed = null,
  sgfeed = null;

//
// start:
//
// start following changes on monitor client and syncgateway
//  also start stat reporter and periodic gateway loader
//
var start = module.exports.start = function(params, done) {

  mystatr = statr(1000) //todo; pass in numclients
  running = true
  startdt = new Date()
  var monitorClient = params.monitorClient
  var gateway = coax([params.gateway, params.gatewaydb]).pax().toString()
  perfdb = params.perfdb
  testid = params.testid

  cfeed = followMonitorClient(monitorClient, gateway)
  gfeed = followSyncGateway(gateway)

  statCheckPointer(monitorClient, gateway, perfdb)
  gatewayWriter(gateway)

  done({ok : 'ok'})  //TODO: monitor once changes event

}

//
// stop:
//
// stop stat collectors and change feed
var stop = module.exports.stop = function(){
    running = false
    cfeed.stop()
    gfeed.stop()
}


// followMonitorClient:
//
function followMonitorClient(monitorClient, gateway){

  var feed = new follow.Feed({
    db : monitorClient,
    filter : function(doc, req){

      /* filter docs from this client */
      if((doc.on != monitorClient) && (doc.on != gateway)){

        /* allow docs since start of collector */
        if(new Date(doc.at) > startdt){
          return true
        }
      }
      return false
    }
  })

  feed.follow()

  feed.on('change', function(json){
    if(json){
      var gotch = new Date()
      coax([monitorClient, json.id], function(err, doc) {
        // record how long it took to receive doc from another client //
        if(doc && doc.on != monitorClient){
          mystatr.stat("change", (gotch-new Date(doc.at)))
          mystatr.stat("doc", (new Date()-new Date(doc.at)))

        }
      })
    }
  })

  return feed
}

// followSyncGateway:
//
// follow gateway changes feed for perf docs
//
function followSyncGateway(gateway){

  coax([gateway,"_changes",
        { filter : "sync_gateway/bychannel",
          channels : "stats",
          feed  : "longpoll",
          since : last_stat_seq}],

            function(err, changes){

            // use latest change
            var change = changes.results.slice(-1)[0]
            var gotch = new Date()

            // fetch doc
            coax([gateway, change.id], function(err, doc){
              if(!err){
                mystatr.stat("directsg-change", (gotch-new Date(doc.at)))
                mystatr.stat("directsg-doc", (new Date()-new Date(doc.at)))
              } else { console.log(err) }
                last_stat_seq = changes.last_seq
                if(running)
                  followSyncGateway(gateway)
              })
            })
}



// gatewayWriter:
//
// every 10s write a doc to gateway
//
function gatewayWriter(gateway){

  var ip = gateway.replace(/[\.,\:,\/]/g,"")
  var id = "perf_"+ip+"_"+process.hrtime(start_time)[0]
  coax.put([gateway,id],
            {at : new Date(), on : gateway, channels : "stats"}, function(err, json){
            if( err != null){
              console.log("Error: unable to push doc to gateway")
              console.log(err)
              gateway_writes++
            }
   })

  setTimeout(function(){
    if(running)
       gatewayWriter(gateway)
  }, 10000)

}

// statCheckPointer:
//
// every 30s collect number of docs relayed to monitor client
// and number of docs on the sync gateway
function statCheckPointer(monitorClient, gateway, perfdb){

  console.log("collect stats: "+running)
  var stat_checkpoint = mystatr.summary()


  //TODO: using request bc sometimes coax hangs
  client = new Client(gateway)
  client.get(gateway, function (err, res, json) {
    if (!err) {
      console.log(json)
      if('doc_count' in json){
        total_writes = json.doc_count
      }
    }

    // query client
    client.get(monitorClient, function (err, res, json){
      if(!err){
        if('doc_count' in json){
          total_relayed = json.doc_count
        }
      }
    })

    var ts = process.hrtime(start_time)[0]
    stat_checkpoint.elapsed_time = ts
    stat_checkpoint.docs_written =  total_writes
    stat_checkpoint.testid = testid
    stat_checkpoint.docs_relayed = total_relayed
    console.log(stat_checkpoint)
    saveStats(stat_checkpoint, perfdb)

  })

  if(running){
    setTimeout(function(){
      statCheckPointer(monitorClient, gateway, perfdb)
    }, 10000)
  }

}

function saveStats(stat_checkpoint, perfdb){

  var id = stat_checkpoint.testid+"_"+stat_checkpoint.elapsed_time
  coax.put([perfdb, id], stat_checkpoint, function(err, json){
    if(err){
      console.log("Warning! Failed to save stats from checkpoint: "+id)
      console.log(err)
    }
  })

}

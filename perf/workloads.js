var coax = require("coax"),
    async = require("async"),
    follow = require("follow"),
    loop = require("nodeload/lib/loop"),
    writer_index = 0,
    doc_map = {},
    perfdb = null,
    start_time = process.hrtime(),
    est_writes_interval = est_writes = total_relayed = total_reads = total_writes = total_changes = 0;

var Workloads = module.exports = {
  writers: {},

  numWriters: function() {
    return Object.keys(Workloads.writers).length;
  },

  /*
    Starts specified workload
    Note that workload methods need to match string provided in params.name
    TODO: To run against multiple 'db's pass in list to params.name
  */
  start: function(params, clients, done) {
    if (params.name in this) {
      async.map(clients, function(client, cb) {
        var url = client.url;
        coax([url, '_all_dbs'], function(err, dbs) {
          if (!err) {
            dbs.forEach(function(db) {
              db = db.replace(/.*:\/\//,"");
              var dbUrl  = coax([url, db]).pax().toString();
              Workloads[params.name](dbUrl, params);
              cb(null, dbUrl);
            });
          } else {
            cb(err, null);
          }
        });
      }, function(err, oks) {
        done({'started' : Workloads.numWriters(), errors : err});
      });
    } else {
      done({err : 'invalid workload method'});
    }
  },

  /*
    Stop all writers
  */
  stop: function(done) {
    var count = Workloads.numWriters();
    console.log(count);

    for (var url in Workloads.writers) {
      Workloads.writers[url].stop();
    }

    setTimeout(function() {
      var stopped = count - Workloads.numWriters();
      done({'stopped' : stopped});
    }, 3000);
  },

  /*
    This workload loads simple docs at the specified read/write ratio
    Returns a writer
  */
  readwrite: function(client, params) {
    var generators = require("../tests/common").generators,
        url = client,
        loop_counter = 0,
        recent_docs = [], // keep last 10 known docs around
        doc_gen = generators.channels;

    doc_map[client] = 0;

    var ip = url.replace(/[\.,\:,\/]/g, "");
    writer = new loop.Loop({
      fun: function(finished) {
        if ((loop_counter%10) < (params.writeRatio/10)) {
          // set at some random delay
          setTimeout(function() {
            // Do a write
            var d = new Date(),
                ts = String(d.getHours()) + d.getMinutes() + d.getSeconds() + d.getMilliseconds(),
                id = "perf"+doc_map[client]+"_"+ip+"_"+ts,
                doc = doc_gen();
            doc.id = id;
            doc.on = url;
            coax.put([url,id],
              doc, function(err, json) {
                if (err !== null) {
                  console.log("ERROR Pushing doc: " + url + "/" + id);
                  console.log(err);
                } else {
                    if ('id' in json) {
                      if (recent_docs.length > 10) {
                        recent_docs.shift();
                      }
                      recent_docs.push(json.id);
                    }
                    doc_map[client] = doc_map[client] + 1;
                    total_writes++;
                }
              });
            }, Math.floor(Math.random() * 10000)); // within a 10s window
          } else {
            if ((loop_counter%10) < (params.readRatio/10)) {
              // Do a read from recent_docs
              if(recent_docs.length > 0) {
                id = recent_docs[Math.floor(Math.random() * recent_docs.length)];
                coax([url, id], function(err, doc) {
                  if(err) {
                    console.log("Error retrieving doc: "+id);
                   }
                });
              }
                total_reads++;
            }
          }
          loop_counter++;
          finished();
        },
        rps: params.requestsPerSec,
        duration: "Inifinity",
    }).start();

    // when writer finished remove it from list
    writer.on("end", function() {
      console.log("done writing to: " + url);
      delete Workloads.writers[url];
    });

    // save writer obj
    Workloads.writers[url] = writer;
  }

};

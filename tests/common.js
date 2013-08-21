var launcher = require("../lib/launcher"),
  coax = require("coax"),
  async = require("async"),
  tstart = process.hrtime(),
  follow = require("follow"),
  events = require('events'),
  fs = require('fs'),
  config = require("../config/local"),
  port = 59850;


var common = module.exports = {

  server : null,

  ee : new events.EventEmitter(),

  launchLS : function(t, done){

    serve = launcher.launchLiteServ({
      port : port,
      dir : __dirname+"/../tmp/single",
      path : config.LiteServPath
    })
    serve.on("error", function(e){
      console.log("error launching LiteServe", e)
      t.fail("error launching LiteServe")
      t.end()
    })
    serve.once("ready", function(err){
      t.false(err, "no error, LiteServe running on our port")
      coax(serve.url, function(err, ok){
        t.false(err, "no error, LiteServe reachable")
        // serve.url = "http://localhost:5984" // couchdb endpoint
        this.server = serve.url

        done(serve)
      })
    });
  },

  launchSG : function(t, done){

    sg = launcher.launchSyncGateway({
      port : 9888,
      dir : __dirname+"/../tmp/sg",
      path : config.SyncGatewayPath,
      configPath : config.SyncGatewayAdminParty
    })
    sg.once("ready", function(err){
      t.false(err, "no error, Sync Gateway running on our port")
      sg.db = coax([sg.url,"db"])
      sg.db(function(err, ok){
        t.false(err, "no error, Sync Gateway reachable")
        done(sg)
      })
    });

  },

  createDBs : function(t, dbs, emits){

    async.map(dbs, function(db, cb){

      // check if db exists
      coax([this.server, db], function(err, json){
          if(!err){
              // delete db
              coax.del([this.server, db], function(err, json){
                  if(err){
                    cb(err, json)
                  } else {
                    coax.put([this.server, db], cb)
                  }
              });
          } else {
              coax.put([this.server, db], cb)
          }
      });
    }, notifycaller.call(t, emits))
  },

  createDBDocs : function(t, params, emits){

    var docgen = params.docgen || 'basic'
    var dbs = params.dbs
    var numdocs = params.numdocs

    async.map(dbs, function(db, nextdb){

      async.times(numdocs, function(i, cb){
        coax.put([server,db, "i"+i], generators[docgen](), cb)
      }, nextdb)

    }, notifycaller.call(t, emits))

  },


  compactDBs : function(t, dbs, emits){

    async.map(dbs, function(db, nextdb){
      coax.post([server, db, "_compact"], nextdb)
    }, notifycaller.call(t, emits))

  },

  createDBBulkDocs : function(t, params, emits){

    var docgen = params.docgen || 'bulk'
    var dbs = params.dbs
    var numdocs = params.numdocs
    var size = params.size || generators.bsize

    if(size > numdocs){
      size = numdocs
    }

    var numinserts = numdocs/size

    async.map(dbs, function(db, nextdb){

      async.times(numinserts, function(i, cb){
        var docs = { docs : generators[docgen](size)}

        coax.post([server,db, "_bulk_docs"], docs, function(err, json){

          if(err){
            console.log(err)
            t.fail("error occurred loading batch")
          }

          // check for oks
          var numOks = json.filter(function(doc) { return doc.ok } )

          if(numOks.length != size){
            t.fail("bulk_docs loaded: "+numOks.length+" expected "+size)
          }

          cb(err, json)
        })

      }, function(err, json){
        coax.post([server, db, "_ensure_full_commit"], function(_err, json){
          if(_err){
            t.fail("error committing docs to db"+_err)
          }
          nextdb(err, json)
        })
      })

    }, notifycaller.call(t, emits))

  },

  updateDBDocs : function(t, params, emits){

    var docgen = params.docgen || 'basic'
    var dbs = params.dbs
    var numdocs = params.numdocs
    var numrevs = params.numrevs

    async.map(dbs, function(db, nextdb){

      async.timesSeries(numrevs, function(revid, nextrev){

        async.times(numdocs, function(i, cb){

          var docid = "i"+i
          var url = coax([server,db, docid]).pax().toString()

          // get document rev
          coax(url, function(err, json){
            if(err || (!json)){
              t.fail("unable to get doc rev")
            }

            var doc = generators[docgen]()

            // preserve other attachments
            if(json._attachments && doc._attachments){
              for(var id in json._attachments){
                if(!(id in doc._attachments)){
                  doc._attachments[id] = json._attachments[id]
                }
              }
            }
            doc._rev = json._rev

            // put updated doc
            coax.put([url], doc, cb)
          })

        },
        notifycaller({emits : "docsUpdating" , cb : nextrev}))

      }, nextdb)

    }, notifycaller.call(t, emits))

  },

  deleteDBDocs : function(t, dbs, numdocs, emits){

    async.map(dbs, function(db, nextdb) {

      async.times(numdocs, function(i, cb){

        var docid = "i"+i
        var url = coax([server,db, docid]).pax().toString()

        // get document rev
        coax(url, function(err, json){

          if(err){
            t.fail("unable to get doc to delete")
          }

          // delete doc
          coax.del([url, {rev : json._rev}], cb)
        })

      }, function(err, json){
        t.equals(json.length, numdocs, "all docs deleted")
        nextdb(err, json)
      })

    }, notifycaller.call(t, emits))

  },

  deleteDBDocAttachments : function(t, dbs, numdocs, emits){

    async.map(dbs, function(db, nextdb) {

      async.times(numdocs, function(i, cb){

        var docid = "i"+i  //TODO: all docs
        var url = coax([server,db, docid]).pax().toString()

        coax(url, function(err, json){

          if(err){
            t.fail("unable to get doc to delete")
          }

          // get attachment ids
          var revid = json._rev

          var attchids = Object.keys(json._attachments)
          async.mapSeries(attchids, function(attid, _cb){

            // delete attachement
            var rmurl = coax([url, attid, {rev : revid}]).pax().toString()

            coax.del(rmurl, function(err, json){
              if(err){
                t.fail("unable to delete attachements")
              }

              // get updated revid
              revid = json.rev
              _cb(err, json)
            })

          }, function(err, json){

            // check if doc exists without attchement
            coax([url], function(err, json){
              if('_attachments' in json){
                t.fail("unable to remove all attachements")
              }
              cb(err, json)
            })
          })
        })

      }, function(err, json){
        t.equals(json.length, numdocs, "all doc attachements deleted")
        nextdb(err, json)
      })

    }, notifycaller.call(t, emits))

  },


  verifyCompactDBs : function(t, dbs, numdocs, emits){

    async.map(dbs, function(db, nextdb){

      async.times(numdocs, function(i, cb){

        // get doc revs info
        var docid = "i"+i
        var url = coax([server,db, docid]).pax().toString()
        url = url+"?revs_info=true"
        coax(url, function(err, json){

          if(err){
            t.fail("unable to get doc rev_info")
          }

          // expect only 1 available rev
          var revs_info = json._revs_info
          var num_avail = revs_info.filter(function(rev,i){
            if(rev.status == "available"){
              return true
            }}).length

          if(num_avail > 1){
              t.fail(num_avail+' uncompacted revision(s) remain')
          }

          if(num_avail < 1){
              t.fail('no doc revisions available')
          }

          cb(err, json)
        })
      }, nextdb)

    }, notifycaller.call(t, emits))

  },


  purgeDBDocs : function(t, dbs, numdocs, emits){

    async.map(dbs, function(db, dbdone){

      async.times(numdocs, function(i, cb){
        // get last rev
        var docid = "i"+i
        var url = coax([server,db, docid]).pax().toString()
        coax(url, function(err, json){
          if(err){
            t.fail("unable to retrieve doc ids")
          }

          // purge doc history
          var doc = {}
          doc[docid] = [json._rev]
          coax.post([server, db, "_purge"], doc, function(e, js){
            if(e){
              console.log(e)
              t.fail("unable to purge doc history")
            }
            cb(e,js)
          })
        })
      }, dbdone)

    }, notifycaller.call(t, emits))
  },


  verifyDBPurge : function(t, dbs, emits){

    this.verifyPurgeDocCount(t, dbs)

    var ctx = this
    this.ee.once('verify-purged',  function(err, json){

      // errs already checked, create some more docs
      ctx.createDBDocs(t, {numdocs : 10 , dbs : dbs}, 'created-docs')

      this.once('created-docs', function(err, json){
          // verify ids
          ctx.verifyPurgeRevIDs(t, dbs)
      })

    })

  },

  // runs after purge to verify all doc_count=0 on all dbs
  verifyPurgeDocCount : function(t, dbs){

    // expecting all documents deleted
    async.map(dbs, function(db, cb){
      coax([server,db], cb)
    }, function(e, responses){
      var numPurged = responses.filter(function(dbinfo){
        return dbinfo.doc_count == 0
        }).length
      t.equals(numPurged, dbs.length, "doc_count=0 on all dbs")

      notifycaller.call(t, 'verify-purged')(e, responses)
    })

  },

  // runs after purge to verify all doc ids=1 on any existing doc
  verifyPurgeRevIDs : function(t, dbs, emits){

    // get 1 doc from each db
    async.map(dbs, function(db, cb){
      var url = coax([server,db,"_all_docs"]).pax().toString()+"?limit=1"
      coax(url, function(e, js){
        if(e){
          t.fail("unable to retrieve db doc")
        }
        var revid = js.rows[0].value.rev.replace(/-.*/,"")
        t.equals(revid, "1", db+" revids reset")
        cb(e, revid)
      })
    }, notifycaller.call(t, emits))

  },

  compareDBSeqNums : function(t, params, emits){

    var sourcedbs = params.sourcedbs
    var targetdbs = params.targetdbs
    var replfactor = params.replfactor || 1

    var i = 0
    async.mapSeries(sourcedbs, function(src, cb){

      var src = coax([server, src]).pax().toString()
      coax(src, function(e, js){
        if(e){
          t.fail("unable to get db info")
        }
        var srcseq = js.update_seq * replfactor
        var tseq = -1

        // follow change feed for update seq
        var tdb = coax([server, targetdbs[i++]]).pax().toString()
        feed = new follow.Feed(tdb)
        feed.follow()
        feed.once('error', function(er){
          console.log(er)
          t.fail("got error on changes feed")
        })

        feed.on('change', function(js){
          tseq = js.seq
          if(tseq > srcseq){
            t.fail("target db has higher seqnum than source")
          }

          if(tseq == srcseq){
            // make sure no new changes incomming
            setTimeout(function(){
              t.equals(tseq, srcseq,
                "verify target "+tdb+" seq "+tseq+" == "+srcseq)
              cb(null, feed)
            }, 2000)
          }
        })

      })

    }, function(err, feeds){
      feeds.map(function(feed){ feed.stop() } )
      notifycaller.call(t, emits)(err, {ok : 'verifyNumDocs'})
    })

  },

  verifyNumDocs : function(t, dbs, numexpected, emits){

    async.mapSeries(dbs, function(db, cb){

      var dburl = coax([server, db]).pax().toString()
      coax(dburl, function(err, json){
        if(err){
          t.fail("failed to get db info")
        }
        t.equals(numexpected, json.doc_count,
          "verified "+db+" numdocs "+numexpected+" == "+json.doc_count)
        cb(err, json)
      })

    }, notifycaller.call(t, emits))

  }

}

// defaultHandler: does final test verification
//
// this method helps to finish a test in an async way
// by running in the context of the test when called
// properly via bind. custom handlers can be written for
// special use cases if needed
//
// * make sure no errors encountered
// * prints errors if any
function defaultHandler(err, oks){

  if(err){
    this.fail("errors occured during test case")
    console.log(err)
  }

  this.end()
}


// multi-purpose helper for async methods
//
// primary purpose is to return a callback which complies with completion of async loops
// * can emit an event on completion
// * can emit an event during innter loop completion and call it's callback
function notifycaller(args){



  if(args && typeof(args) == 'string'){
    args = {emits : args}
  }

  var tctx = this
  return function(err, json){

    if(args){

      if(args.emits){
        common.ee.emit(args.emits, err, json)
      }

      if(args.cb){
        args.cb(err, json)
      }
    } else {
      // nothing to do, end test
      tctx.end()
    }

  }

}

//########## doc generators #########
var generators = module.exports.generators = {

  bsize : 100,

  basic :  function(){

  var suffix = Math.random().toString(26).substring(7)
  var id = "fctest:"+process.hrtime(tstart)[1]+":"+suffix
  return { _id : id,
           data : Math.random().toString(5).substring(4),
             at : new Date()}

  },

  bulk : function(size){

    var size = size || this.bsize
    var docs = []

    for (i = 0; i < size; i++){
      docs.push(this.basic())
    }
    return docs
  },

  inlineTextAtt : function(){

    var suffix = Math.random().toString(26).substring(7)
    var id = "fctest:"+process.hrtime(tstart)[1]+":"+suffix
    var text = "Inline text string created by cblite functional test"
    var data = new Buffer(text).toString('base64');

    return { _id : id,
             text: text,
             at : new Date(),
             _attachments :
              {
                "inline.txt" :
                {
                  "content-type" : "text\/plain",
                  "data" : data
                }
              }
      }
  },

  inlinePngtAtt : function(){

    var suffix = Math.random().toString(26).substring(7)
    var id = "fctest:"+process.hrtime(tstart)[1]+":"+suffix
    var data_binary = fs.readFileSync('tests/data/ggate.png', {encoding : 'base64'})

    var img = "tests/data/ggate.png"

    return { _id : id,
             img : img,
             at : new Date(),
             _attachments :
              {
                "ggate.png" :
                {
                  "content-type" : "image\/png",
                  "data" : data_binary
                }
              }
      }
  },

  bulkInlineTextAtt : function(size){

    var size = size || this.bsize
    var docs = []

    for (i = 0; i < size; i++){
      docs.push(this.inlineTextAtt())
    }
    return docs
  }

}

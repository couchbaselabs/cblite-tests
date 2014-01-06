var launcher = require("../lib/launcher"),
  http = require("http"),
  coax = require("coax"),
  async = require("async"),
  tstart = process.hrtime(),
  follow = require("follow"),
  events = require('events'),
  util =  require("util"),
  fs = require('fs'),
  logger = require("../lib/log"),
  listener = require('../lib/listener'),
  conf_file = process.env.CONF_FILE || 'local',
  config = require('../config/' + conf_file),
  perfconfig = require('../config/perf.js'),
  port = 59850;


var common = module.exports = {

  listener : null,
  server : null,

  ee : new events.EventEmitter(),

  // DEPRECIATED: use launchClient
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

  launchClient : function(t, done){

    if(!this.listener){
      this.listener = listener.start()
    }
    var url = "http://"+config.LocalListenerIP+":"+config.LocalListenerPort
    this.listener.url = url
    var testendpoint = config.provides

    if(testendpoint == "ios"){
      coax.post([url, "start", "ios"], function(err, json){
        t.false(json.error, "error launching LiteServe "+JSON.stringify([err, json]))
        this.server = json.ok
        done(this.server)
      })
    } else if(testendpoint == "pouchdb"){
      coax.post([url, "start", "pouchdb"], function(err, json){
        t.false(json.error, "error launching pouchdb client")
        this.server = json.ok
        done(this.server)
      })
    } else if(testendpoint == "android"){
    // TODO: requires manual launch
        port = config.LiteServPort || 8080
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
            coax(server, function(err, ok){
            t.false(err, "no error, LiteServe reachable" +err)
            t.end()
        })
        this.server = "http://localhost:"+port
            server = this.server
            done(this.server)
            })
    } else if(testendpoint == "couchdb"){
      // TODO: requires manual launch
      this.server = "http://localhost:5984"
      done(this.server)
    }
  },

  cleanup : function(t, done){
    var ctx_listener = this.listener

    coax([ctx_listener.url, "cleanup"], function(err, json){
         ctx_listener.close()
         done(json)
     })

  },

  launchSG : function(t, done){
    sg = launcher.launchSyncGateway({
      port : 9888,
      db : config.DbUrl,
      bucket : config.DbBucket,
      dir : __dirname+"/../tmp/sg",
      path : config.SyncGatewayPath,
      configPath : config.SyncGatewayAdminParty
    })
    sg.once("ready", function(err){
      if(t)
        t.false(err, "no error, Sync Gateway running on our port")
      sg.db = coax([sg.url, config.DbBucket])
      sg.db(function(err, ok){
        if(t)
          t.false(err, "no error, Sync Gateway reachable")
        done(sg)
      })
    });

  },

  launchSGWithParams : function(t, port, db, bucket, done){
      sg = launcher.launchSyncGateway({
        port : port,
        db : db,
        bucket : bucket,
        dir : __dirname+"/../tmp/sg",
        path : config.SyncGatewayPath,
        configPath : config.SyncGatewayAdminParty

      })
      sg.once("ready", function(err){
        if(t)
          t.false(err, "no error, Sync Gateway running on port " + port)
        sg.db = coax([sg.url, bucket])
        sg.db(function(err, ok){
          if(t)
            t.false(err, "no error, Sync Gateway reachable by: " + sg.url)
          done(sg)
        })
      });

    },

  createDBs : function(t, dbs, emits){
    async.mapSeries(dbs, function(db, cb){
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


	http_get_api : function(t, options, callback){
		var request = http.get(options, function(response) {
			response.setTimeout(10, [callback])

			var body = '';

			response.on('data', function (chunk){
				body += chunk;
			})

			response.on('error', function (e){
				logger.error("Got error: " + e.message)
				t.fail("ERROR ")
			})

			response.on('end', function (){
				logger.info(response.statusCode + " from http://"+options.host + ":"+options.port+options.path)

				if(response.statusCode=='200' || response.statusCode=='201'){
					try {
						body = JSON.parse(body);
					} catch(err){
					    console.warning("not json format of response body");
					}
					callback(body)
				}
				else{
					logger.info(body)
					t.fail("wrong response status code " + response.statusCode + " from http://"+options.host + ":"+options.port+options.path)
					t.end()
				}
			})
		})
	},

		http_post_api : function(t, post_data, options, callback){
			var body = '';
			var req=http.request(options, function(response) {

				response.setEncoding('utf8');

				response.on('data', function (chunk){
					console.log(chunk)
					body += chunk;
					callback(body);
				})

				response.on('error', function (e){
					logger.error("Got error: " + e.message)
					t.fail("ERROR ")
					t.end()
				})

				response.on('end', function (){
					logger.info(response.statusCode + " from http://"+options.host + ":"+options.port+options.path)

					if(response.statusCode=='200' || response.statusCode=='202'){
						try {
							body = JSON.parse(body);
						} catch(err){
						    logger.warn("not json format:" + body);
						}
						logger.info("callback")
						callback(body)
					}
					else{
						logger.info(body)
						t.fail("wrong response status code " + response.statusCode + " from http://"+options.host + ":"+options.port+options.path)
						t.end()
					}
				})
			});
			logger.info(post_data)
			req.write(post_data);
			req.end();
			},


	 compactDBs : function(t, dbs, emits){

		    async.map(dbs, function(db, nextdb){
		      coax.post([server, db, "_compact"], nextdb)
		    }, notifycaller.call(t, emits))

		  },

  createDBDocs : function(t, params, emits){
    var docgen = params.docgen || 'basic'
    var dbs = params.dbs
    var numdocs = params.numdocs
    var localdocs = params.localdocs || ""
    //for local documents id formed as _local/ID
    if (localdocs) localdocs= localdocs + "/"
    async.map(dbs, function(db, nextdb){
	async.times(numdocs, function(i, cb){
		var docid = db+"_"+i
	    var madeDoc = generators[docgen](i)
	    madeDoc._id = docid
	    coax.put([server,db, localdocs + docid], madeDoc, function(err, ok){
	    if (err){
	        t.false(err, "error loading " + server + "/" + db + "/"+ localdocs + docid +":" + err)
	    } else
	        t.equals(localdocs + docid, ok.id, "docid")
	    cb(err, ok)
	    })

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
        var docs = { docs : generators[docgen](size, i)}

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

          var docid = db+"_"+i
          var url = coax([server,db, docid]).pax().toString()

          // get document rev
          coax(url, function(err, json){
            if(err || (!json) || json == undefined){
                t.fail("unable to get doc rev for url:" + url + ", err:" + err + ", json:" + json)
                cb(err, json)
            } else {
                var doc = generators[docgen](i)
                // preserve other attachments
                if(json._attachments && doc._attachments){
                    for(var id in json._attachments){
                        if(!(id in doc._attachments)){
                            doc._attachments[id] = json._attachments[id]
                            }
                        }
                    }
                // preserve id and rev
                doc._id = json._id
                doc._rev = json._rev
                // put updated doc
                coax.put([url], doc, cb)
            }
          })

        },
        notifycaller({emits : "docsUpdating" , cb : nextrev}))

      }, nextdb)

    }, notifycaller.call(t, emits))

  },

  deleteDBDocs : function(t, dbs, numdocs, localdocs, emits){
    var localdocs = localdocs || ''
    if (localdocs) localdocs= localdocs + "/"
    async.map(dbs, function(db, nextdb) {

      async.times(numdocs, function(i, cb){

        var docid = db+"_"+i
        var url = coax([server, db, localdocs + docid]).pax().toString()

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

        var docid = db+"_"+i
        var url = coax([server,db, docid]).pax().toString()

        coax(url, function(err, json){

          if(err){
            t.fail("unable to get doc to delete " + url + ": " + JSON.stringify(err))
          }

          // get attachment ids
          var revid = json._rev

          var attchids = Object.keys(json._attachments)
          async.mapSeries(attchids, function(attid, _cb){

            // delete attachment
            var rmurl = coax([url, attid, {rev : revid}]).pax().toString()

            coax.del(rmurl, function(err, json){
              if(err){
                t.fail("unable to delete attachments by " + rmurl + ": " + JSON.stringify(err))
              }

              // get updated revid
              revid = json.rev
              _cb(err, json)
            })

          }, function(err, json){

            // check if doc exists without attchement
            coax([url], function(err, json){
              if('_attachments' in json){
                t.fail("unable to remove all attachments")
              }
              cb(err, json)
            })
          })
        })

      }, function(err, json){
        t.equals(json.length, numdocs, "all doc attachments deleted")
        nextdb(err, json)
      })

    }, notifycaller.call(t, emits))

  },


  verifyCompactDBs : function(t, dbs, numdocs, emits){

    async.map(dbs, function(db, nextdb){

      async.times(numdocs, function(i, cb){

        // get doc revs info
        var docid = db+"_"+i
        var url = coax([server,db, docid]).pax().toString()
        url = url+"?revs_info=true"
        coax(url, function(err, json){

          if(err){
            t.fail("unable to get doc rev_info")
          }

          // expect only 1 available rev
          var revs_info = json._revs_info
          if (revs_info == undefined){
              console.log("response of " + url + " doens't contain _revs_info:" + json)
              t.fail("response of docid failed")
          } else{
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
        var docid = db+"_"+i
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

  //issue#112 couchbase-lite-android: missed some keys in /DB API: instance_start_time,committed_update_seq,disk_format_version,purge_seq
  // checks that the sequence_no's between two sets of dbs match
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
        var seq_history= []
        var tdb = coax([server, targetdbs[i++]]).pax().toString()
        var feed = new follow.Feed(tdb)
        feed.follow()
        feed.on('error', function(er){
          console.log(er)
          t.fail("got error on changes feed")
        })

        feed.on('change', function(js){

          // get seqno
          tseq = js.seq

          // check for dupe seqno's
          if(tseq in seq_history){
            var err = "detected duplicate sequence_no "+tseq
            console.log(err)
            cb(err, feed)

          // we don't expect target seqno to exceed source
          // we can't do this because sequence-ids are not numbers,
          // they are opaque tokens, and can't be compared with >
          // else if (tseq > srcseq){
            // err = "target db seqnum is "+tseq+" expected "+srcseq
            // cb(err, feed)
          } else if(tseq == srcseq){
            // make sure no new changes incomming
            setTimeout(function(){
              t.equals(tseq, srcseq,
                "verify target "+tdb+" seq "+tseq+" == "+srcseq)
              cb(null, feed)
            }, 2000)
          } else {
            seq_history.push(tseq)
          }
        })

      })

    }, function(err, feeds){

        // stop all feeds
        async.map(feeds, function(feed, cb){
          feed.stop()
          cb(null, null)
        }, function(_e, _j){
          notifycaller.call(t, emits)(err, {ok : 'verifyNumDocs'})
        })
    })

  },

  // checks that doc_count == numexpected docs on db
  // gives up after 10 seconds
  verifyNumDocs : function(t, dbs, numexpected, emits){

    async.map(dbs, function(db, cb){

      var dburl = coax([server, db]).pax().toString()
      var doc_count = -1
      var tries = 0

      async.whilst(
        function () {
          if(tries >= 60){ return false}
          return  numexpected != doc_count;
        },
        function (_cb) {

          // get doc count every 3s
          setTimeout(function(){
            coax(dburl, function(err, json){
              if(err){
                t.fail("failed to get db info from " + dburl)
              }
              doc_count = json.doc_count
              if (json == undefined) {
                  t.fail("json.doc_count is undefined in: " + json)
              } else {
                  console.log(db + " has " + doc_count + " docs expecting " + numexpected)
              }
              _cb(err)
            })
            tries++
          }, 2000)
        },
        function (err) {
          cb(err, { ok : doc_count})
          t.equals(numexpected, doc_count,
                  "verified " + db + " numdocs " + numexpected + " == " + doc_count)
      });
    }, notifycaller.call(t, emits))

  },

  setupPushAndPull: function (server, dba, dbb, cb) {
    console.log("_replicate server: " + server + " source: " + dba + " -> target: " + dbb)
    coax.post([server, "_replicate"], {
      source : dba,
      target : dbb,
      continuous : true
    }, function(err, info) {
      if (err) {return cb(err)}
      console.log("_replicate server: " + server + " source: " + dbb + " -> target: " + dba)
      coax.post([server, "_replicate"], {
        source : dbb,
        target : dba,
        continuous : true
      }, cb)
    })
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
      if(err){
        tctx.fail(JSON.stringify(err))
      }
      tctx.end()
    }

  }

}

// the channel name function -- can be monkeypatched for advanced workloads

module.exports.randomChannelNameGen = function (num_chans) {

  if (!num_chans)
    num_chans = perfconfig.numChannels

  // base10 number between 0-1M
  var rand = Math.random().toString(10).substring(2,6)

  // reduce to number of sig digits
  var channel = Number(rand.substring(rand.length - String(num_chans).length, rand.length))


  if(channel > num_chans){
    // reduce channel
    channel = String(channel)
    channel = Number(channel.substring(0, channel.length -1))
  }

  return channel
}

module.exports.randomChannelName = function () {

  // return a channel within set of hot channels
  return module.exports.randomChannelNameGen(perfconfig.hotChannels)
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

  channels : function(chans){
    var suffix = Math.random().toString(26).substring(7)
    var id = "fctest:"+process.hrtime(tstart)[1]+":"+suffix
    if(!chans){
      chans = [];
      do {
        chans.push(module.exports.randomChannelName())
      } while (chans.length < config.channelsPerDoc);
    }

    return { _id : id,
             data : Math.random().toString(5).substring(4),
             channels : chans,
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
    var img = __dirname+"/../tests/data/ggate.png"
    var data_binary = fs.readFileSync(img, {encoding : 'base64'})


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
  },

  foobar : function(){
    return { foo : "bar" }
  },

  player : function(i){
    var img = __dirname+'/../tests/data/cblogo.png'
    var photo = fs.readFileSync(img, {encoding : 'base64'})
    var profile = "cblite functional test, player"
    profile = new Buffer(profile).toString('base64');

    return  {  joined : [2013,
                         7,
                         i],
                points : i,
                _attachments :
                 {
                   "photo.png" :
                   {
                     "content-type" : "image\/png",
                     "data" : photo
                   },

                   "profile.txt" :
                   {
                     "content-type" : "text\/plain",
                     "data" : profile
                    }
                 }
              }

  }

}

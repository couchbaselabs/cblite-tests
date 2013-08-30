var coax = require("coax")

// var dbURL = "http://sync.couchbasecloud.com:4984/guestok67/"

var dbURL = "http://localhost:4984/db/"

var db = coax(dbURL)


db("_changes", function (err, data) {
  var changes = data.results.map(function(r){return r.id});
  db("_all_docs", function(err, view){
    var docs = view.rows;
    var missing = [];

    docs.forEach(function(d){
      if (changes.indexOf(d.id) == -1) {
        missing.push(d.id)
      }
    })

    var changeIds = {}, dupIds = [];
    var changeSeqs = {}, dupSeqs = [];

    data.results.forEach(function(r){
      if (changeIds[r.id]) {
        dupIds.push(r.id)
      }
      changeIds[r.id] = true

      if (changeSeqs[r.seq]) {
        dupSeqs.push(r.seq)
      }
      changeSeqs[r.seq] = true
    })



    console.log("missing "+missing.length+", ids:", missing.join(', '))
    console.log("duplicate change ids "+dupIds.length+", ids:", dupIds.join(', '))
    console.log("duplicate change seqs "+dupSeqs.length+", seqs:", dupSeqs.join(', '))


  })

})

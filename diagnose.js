var coax = require("coax")


var db = coax("http://sync.couchbasecloud.com:4984/guestok92/")


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
    console.log("missing "+missing.length+", ids:", missing.join(', '))

  })

})

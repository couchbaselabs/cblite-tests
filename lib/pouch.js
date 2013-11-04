var pouchdb = require('express-pouchdb'),
  rmdir = require("../lib/rmdir"),
  mkdir = require("../lib/mkdir"),
  port = process.argv[2],
  dir=__dirname + '/../tmp/pdb-'+port;


// move to db directory
try{
  rmdir(dir)
} catch (e) {}
mkdir(dir)

process.chdir(dir)
console.log(process.cwd())
client = pouchdb.listen(port)
process.send('PouchDB server listening on ' + port + '.\n')

process.on("message", function(m){
  if (m['ok'] == "kill"){
    client.close()
  }
})

var spawn = require('child_process').spawn,
  fork = require('child_process').fork;

exports.launchSyncGateway = function(opts){

  db = "walrus:"
  bucket = "db"

  if ('db' in opts)
    db = opts.db

  if ('bucket' in opts)
    bucket = opts.bucket

  var argv = [
    "-interface", ":"+opts.port,
    "-adminInterface", ":"+(opts.port + 1),
    "-url",db,
    "-bucket", bucket,
  ]
  if (opts.configPath)
    argv.push(opts.configPath)

  console.log("running",opts.path, argv)

  var sg = spawn(opts.path, argv);
  sg.stdout.pipe(process.stdout)
  sg.stderr.pipe(process.stderr)

  sg.stderr.on("data",function(data){
    if (data.toString().indexOf("Starting server on :"+opts.port) !== -1) {
      sg.emit("ready")
    }
  })

  sg.on("error", function(err){
    console.log("error from sync_gateway spawn", opts.path, argv)
  })

  sg.url = "http://localhost:"+opts.port+"/"

  process.on("exit", function(){
    sg.kill()
  })
  return sg;
}

exports.launchLiteServ = function(opts){
  var run = opts.path,
    argv = ["--port", opts.port];

  if(opts.dir) {
    argv.push("--dir")
    argv.push(opts.dir)
  }

  var liteserv = spawn(opts.path, argv)

  liteserv.stderr.on("data",function(data){
    if (data.toString().indexOf("is listening on port "+opts.port) !== -1) {
      liteserv.emit("ready")
    }
  })

  liteserv.url = "http://localhost:"+opts.port
  process.setMaxListeners(500)
  process.on("exit", function(){
    liteserv.kill()
  })

  return liteserv;
}

exports.launchEmbeddedClient = function(opts){


  var port = opts.port

  var pdb = fork("lib/pouch.js", [port])

  pdb.on('message', function(data) {
    console.log(data)
    pdb.emit("ready")
  });

  pdb.kill = function(){
    process.kill(pdb.pid)
  }
  return pdb;

}

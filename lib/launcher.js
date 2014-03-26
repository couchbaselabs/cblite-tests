var spawn = require('child_process').spawn,
  fork = require('child_process').fork,
  conf_file = process.env.CONF_FILE || 'local',
  config = require('../config/' + conf_file);

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
		setTimeout(function() {
			sg.emit("ready")
		}, (function() {
			return 1000;
		})())
	}
    console.log("" + data);
  })

  sg.on("error", function(err){
    console.log("error from sync_gateway spawn", opts.path, argv, err)
  })

  sg.url = "http://localhost:"+opts.port+"/"

  process.on("exit", function(){
    sg.kill()
  })
  return sg;
}

exports.launchLiteServ = function(opts) {
	var argv = [ "--port", opts.port ];

	if (opts.dir) {
		argv.push("--dir")
		argv.push(opts.dir)
	}
	if (config.provides == "android") {
		process.chdir(opts.path);

//		var liteserv = spawn(opts.path + '/run_android_liteserv.sh', [ opts.port ]);
		var liteserv =spawn('adb', [ "shell", "am start -a android.intent.action.MAIN -n com.couchbase.liteservandroid/com.couchbase.liteservandroid.MainActivity --ei listen_port", opts.port ]);
		spawn("adb", ["forward tcp:", opts.port, "tcp:", opts.port])

	} else {
		var liteserv = spawn(opts.path, argv)
	}

	liteserv.stderr.on("data", function(data) {
		// on Mac
		if ((data.toString().indexOf("is listening on port " + opts.port) !== -1)
			|| (data.toString().indexOf("is listening at ") != -1)) {
			liteserv.emit("ready")
			}
        console.log("" + data);
		})

	liteserv.stdout.on("data", function(data) {
		// on Android
		if (data.toString().indexOf("has extras") != -1) {
			console.log("LiteServAndroid launched on " + opts.port)
			setTimeout(function() {
				liteserv.emit("ready")
			}, (function() {
				return process.env.SLEEP_AFTER_LAUNCH || 6000;
			})())
		}
		console.log("" + data);
	})

	process.on("exit", function() {
		if (config.provides == "android") {
			spawn('adb', [ "shell", "am", "force-stop", "com.couchbase.liteservandroid" ]);
		} else {
			liteserv.kill()
		}

	})

	liteserv.url = "http://localhost:" + opts.port
	process.setMaxListeners(500)

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
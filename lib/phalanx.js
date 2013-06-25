var spawn = require('child_process').spawn,
  async = require("async"),
  EE = require('events').EventEmitter;

exports.launchLiteServ = function(size, opts){
  var run = opts.path,
    argv = ["--port", opts.port];

    argv.push("--dir")
    argv.push(opts.dir)

  var ee = new EE();
  ee.liteservs = [];
  async.times(size, function(i, cb){
    argv[1] = (opts.port + i).toString()
    argv[3] = opts.dir + "/ls-" + i
    // opts.path = "./args.bash"
    var liteserv = spawn(opts.path,argv)
    // console.log("LS",opts.path,argv)
    // liteserv.stdout.pipe(process.stdout)
    // liteserv.stderr.pipe(process.stdout)

    liteserv.stderr.on("data",function(data){
      // console.log(data.toString())
      if (data.toString().indexOf("is listening on port 0") !== -1) {
        ee.emit("error", "random_port")
        console.log("error loading serv", data.toString())
      }
      if (data.toString().indexOf("is listening on port "+(opts.port+i)) !== -1) {
        liteserv.emit("ready")
      }
    })
    liteserv.once("ready", function(){
      cb(false, "http://localhost:"+(opts.port + i)+"/")
    })
    ee.liteservs.push(liteserv)
  }, function(err, ok){
    ee.servers = ok;
    ee.emit("ready", ok);
  })

  ee.kill = function() {
    ee.liteservs.forEach(function(ls){
      ls.kill()
    })
  }

  process.on("exit", function(){
    ee.kill()
  })

  return ee;
}

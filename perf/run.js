var perftests = require('../perf/test'),
    common = require("../tests/common"),
    params = require('../config/perf'),
    // start local listener
    listener = require('../lib/listener').start();


// print params when test started
var started = function(result){
  console.log(result)
}

// close listener when test completes
var complete = function(result){

  listener.close()

  // TODO: good place to replicate stats somewhere
  console.log(result)
}

// start test
perftests.run(params, started, complete)

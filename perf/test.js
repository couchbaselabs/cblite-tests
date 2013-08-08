rtdelay = require('../perf/round_trip_delay')

run = module.exports.run = function(test){

  console.log(test)
  if(test == 'round_trip'){
    rtdelay.run()
  }
  

}

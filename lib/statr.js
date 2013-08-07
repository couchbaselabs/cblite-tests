var Stats = require("fast-stats").Stats

module.exports = function () {
  var trackers = {};
  return {
    summary : function() {
      var result = {};
      for (var k in trackers) {
        if (trackers.hasOwnProperty(k)) {
          result[k] = {
            avg : trackers[k].amean(),
            count : trackers[k].length,
            perc : trackers[k].percentile(90),
            median : trackers[k].percentile(50),
            stddev : trackers[k].stddev(),
            dist : (trackers[k].distribution()).map(function(d){ return d.count }),
            last : trackers[k].last,
          }
        }
      }
      return result
    },
    stat : function (name, value) {
      if (!trackers[name]) {
        trackers[name] = new Stats({store_data : true, bucket_precision: 100})
      }
      if (!isNaN(value))
        trackers[name].push(value);
        trackers[name].last = value;
    }
  }
}

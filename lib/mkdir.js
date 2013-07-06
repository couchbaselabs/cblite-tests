var fs = require("fs");

var mkdir = function(dir) {

  fs.exists(dir, function (exists) {
    if(!exists)
      fs.mkdirSync(dir)
  });

}
module.exports = mkdir;

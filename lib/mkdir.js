var fs = require("fs");

var mkdir = function(dir) {

try{
  fs.mkdirSync(dir)
} catch (e) {
  if (e.code != 'EEXIST'){
    console.log(e)
  }
}

}
module.exports = mkdir;

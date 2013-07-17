mkdir -p tmp
rm -rf tmp/$1
mkdir tmp/$1
cd tmp/$1
../../node_modules/pouchdb-server/bin/pouch $1

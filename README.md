## Mobile API tests

Since mobile is all about a ReST protocol for sync, we can test it at the ReST level.

We can also drive the clients from a ReST interface, having them apply load to server components.

## Install the servers under test

You should be able to get away with, at a bare minimum, LiteServ and Sync Gateway. If you have both of those, you should be able to run all the topologies. But if you add more hosts or want to test Sync Gateway storage with CBGB or Couchbase Server you'll need to configure those.

### Couchbase Lite

To install LiteServ, download the latest stable build from the link [in the Couchbase Lite README](https://github.com/couchbase/couchbase-lite-ios) and find LiteServ in the MacOS directory. Edit `config/local.js` to link to it.

### Sync Gateway

Follow the instructions [on the Sync Gateway readme, about how to install](https://github.com/couchbaselabs/sync_gateway/wiki/Installing-and-Upgrading). Remember the path you downloaded it to so you can edit `config/local.js` to point to it.

### Node.js

You'll need a newish Node.js install (>0.8) with npm. We recommend `brew install nodejs`

# How to run these tests

First edit `config/local.js` to point to your build of LiteServ (found via "Products" in Xcode). Also to your local bin/sync_gateway

Get the dependencies with `npm install`. (It reads `package.json` to know what to get.)

Make a `tmp` directory inside your `mobile-testing` checkout, by running `mkdir tmp`

Run the tests with `npm test`. NPM test will pick up any file in the 'tests' directory.

To run a particular test, try `node tests/liteserv-phalanx.js`

## How to run performance tests:

The simplest way to run a perf test is to update config/perf.js to match your configuration and start the test using run.js:
`node perf/run.js`

You can also start tests over http by starting a listener and sending the request over http:
`node lib/listener.js`
`http POST http://127.0.0.1:8189/run/perf/readwrite db=test-perf workload=readwrite numClients=2 writeRatio=10 readRatio=0 requestsPerSec=1 runtime=60 providers:='["http://127.0.0.99:8189"]' enablepull:=false`

Note: values in config/perf.js will be used by default for any specified arguments, otherwise http query params will override those variables

Collected stats will be stored into perfdb specefied in `config/perf.js`.  This can be any endpoint that implements the couchdb api. 

## Troubleshooting

`killall LiteServ` is your friend.

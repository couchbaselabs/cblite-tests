## Mobile API tests

Since mobile is all about a ReST protocol for sync, we can test it at the ReST level.

We can also drive the clients from a ReST interface, having them apply load to server components.

## Install the servers under test

You should be able to get away with, at a bare minimum, LiteServ and Sync Gateway. If you have both of those, you should be able to run all the topologies. But if you add more hosts or want to test Sync Gateway storage with CBGB or Couchbase Server you'll need to configure those.

### Couchbase Lite

To install LiteServ, download the latest stable build from the link [in the Couchbase Lite README](https://github.com/couchbase/couchbase-lite-ios) and find LiteServ in the MacOS directory. Edit `config/local.js` to link to it.

### Sync Gateway

Follow the instructions [on the Sync Gateway readme, about how to install](https://github.com/couchbaselabs/sync_gateway/wiki/Installing-and-Upgrading). Edit `config/local.js`

### Node.js

You'll need a newish Node.js install (>0.8) with npm. We recommend `brew install nodejs`

## How to run these tests

First edit `config/local.js` to point to your build of LiteServ (found via "Products" in Xcode).

Get the dependencies with `npm install`. (It reads `package.json` to know what to get.)

Make a `tmp` directory inside your `test-mobile` checkout, by running `mkdir tmp`

Run the tests with `npm test`. NPM test will pick up any file in the 'tests' directory.

To run a particular test, try `node tests/liteserv-phalanx.js`




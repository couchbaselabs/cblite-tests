// This test inserts data as fast as it can from N threads (you set the N).
// It has a target to run _bulk_docs inserts into,
// and a URL for a database to verify the changes feed on.
// In simple cases the changes feed is read from the same database that is
// written to, but in other cases we read it from a database on the other
// end of a sync connection


// run this against Couchbase Lite on Mac to estimate how it slows down with bigger datasets
// run this from the HTML5 harness to see what happens with Couchbase Lite big data under load on real devices
// run this against Sync Gateway to see how it's changes feed latencies are effected by lots of documents
// run this from a phone syncing to a Sync Gateway and measure sync performance as the dataset size grows
// run this from an Apache CouchDB to a Cloudant for competitive intelligence

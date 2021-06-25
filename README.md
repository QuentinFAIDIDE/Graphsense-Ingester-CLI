# Graphsense Ingester CLI
Command line interface to control the (unofficial) ingestion micro-services.

This software is still in early alpha, many features are still missing.

## Requirements
You need to have `npm` and `node` installed, as well as a running instance of at least one the **Bitcoin Ingester Service** microservice. The redis cache in use by the latter should be accessible and is the redis instance whose contact info are passed to this cli interface.

## Install
Install the nodejs packages.
```
npm install
```

## Ingest a range of blocks 
```
./gsingestctl ingest_range --chain BTC --start-block 300000 --end-block 300100 --redis-host myredishost --port-redis 6379 -k mykeyspace
```

Stopping the software with ctrl+c does not cancel the jobs for the keyspace yet. To cancel the jobs, stop the microservices and open a `redis-cli` shell to clear the job stacks:
```
DEL BTC::jobs::todo
DEL BTC::jobs::doing
```

You can also clear the errors and finished jobs stack if you want (but it's not necessary if you're looking into stopping the service):
```
DEL BTC::jobs::errors
DEL BTC::jobs::done
```
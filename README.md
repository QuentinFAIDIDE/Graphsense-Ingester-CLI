# Graphsense Ingester CLI
Command line interface to control the ingestion micro-services.

This software is still in early alpha, many features are still missing.

## Requirements
You need to have `npm` and `node` installed, as well as a running instance of at least one the **Bitcoin Ingester Service** microservice. The redis cache in use by the latter should be accessible and is the redis instance whose contact info are passed to this cli interface.

## Install
Install the nodejs packages.
```
npm install
```

## Usage
You can add keyspaces that will be monitored to generate ingesting jobs that will be picked by the microservices to fill blockchain data in cassandra according to the graphsense schemas. You can also monitor the advancement, remove a keyspace, or purge job queues.
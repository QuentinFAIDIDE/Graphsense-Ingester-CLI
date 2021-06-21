const {
  get_supported_chains,
  push_jobs,
  register_ingestion_job,
  prepare_redis_client,
  get_jobs_todo,
  monitor_jobs
} = require('./etl-job-interraction.js');
const ora = require('ora');

function exec_range_ingestion(args) {
    // check if chain is valid
    if(get_supported_chains().includes(args.chain.toLowerCase())==false) {
        console.error("Chain "+args.chain+" not supported");
        process.exit(1);
    }

    // check if range is valid
    if(Number.isNaN(Number(args.start_block)) || 
       Number.isNaN(Number(args.end_block)) || 
       args.start_block<0 || args.end_block<args.start_block) {
        console.error("Invalid block range");
        process.exit(1);
    }
    // TODO: get last block available and test against it

    // check if splitting range is valid
    if(Number.isNaN(Number(args.block_size)) ||
       args.block_size < 1) {
        console.error("Invalid block size");
        process.exit(1);
    }

    const spinnerRedis = ora({
        text:'Connecting to redis...',
        stream: process.stdout
    }).start();
    spinnerRedis.color = 'red';

    // preapare redis client
    prepare_redis_client(
        args.redis_host, args.port_redis, args.chain, args.keyspace)
        .then(() => {
          // update spinner
          spinnerRedis.succeed();
          const spinnerJob =
              ora({
                text: "Fetching existing jobs in the todo list...",
                stream: process.stdout,
                color: "yellow"
              }).start();

          // get the list of jobs already planned to watch for duplicates
          get_jobs_todo(args.chain)
              .then(() => {
                spinnerJob.succeed();
                const spinnerPush = ora({
                                      text: "Pushing jobs...",
                                      stream: process.stdout,
                                      color: "yellow"
                                    }).start();

                // split job into subtask of blck size
                let furthest_block_sent = Number(args.start_block) - 1;
                let end = Number(args.end_block);
                let split_size = Number(args.block_size);
                while ((furthest_block_sent + split_size) <= end) {
                  // sending job for subrange
                  register_ingestion_job(
                      args.chain.toLowerCase(), args.keyspace,
                      furthest_block_sent + 1,
                      furthest_block_sent + split_size);
                  furthest_block_sent += split_size;
                }

                // if there is a remainder, send it as well
                if (furthest_block_sent < end) {
                  register_ingestion_job(
                      args.chain.toLowerCase(), args.keyspace,
                      furthest_block_sent + 1, end);
                }

                push_jobs()
                    .then(() => {
                      spinnerPush.succeed();

                      // now, monitor the job for success and failures
                      monitor_jobs();
                    })
                    .catch((err) => {
                      console.error(err);
                      process.exit(1);
                    })
                // get work planned error management
              })
              .catch((err) => {
                console.error(err);
                process.exit(1);
              });
        });
}

module.exports = { exec_range_ingestion };
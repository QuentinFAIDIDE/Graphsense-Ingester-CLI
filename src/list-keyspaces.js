const {
    get_supported_chains,
    push_jobs,
    register_ingestion_job,
    prepare_redis_client,
    get_jobs_todo,
    monitor_jobs
  } = require('./etl-job-interraction.js');

let redis = require("redis");

const ora = require('ora');

function exec_list_keyspaces(args) {

    const spinnerRedis = ora({
        text:'Connecting to redis',
        stream: process.stdout
    }).start();
    spinnerRedis.color = 'red';

    let redisClient = redis.createClient({host: args.redis_host, port: args.port_redis});

    redisClient.on("error", (err)=>{
        console.error("Unable to connect to redis at host "+args.redis_host+":"+args.port_redis);
        process.exit(1);
    });

    redisClient.on("connect", ()=>{

        spinnerRedis.succeed();

        let chains = get_supported_chains();

        let nbFinished = 0;

        // for each crypto
        for(let i=0;i<chains.length;i++) {
            // get the sets with the keyspaces
            redisClient.smembers(""+chains[i].toUpperCase()+"::monitored-keyspaces", (errSME, resSME)=>{

                if(errSME) {
                    console.error("Redis error:"+errSME);
                    process.exit(1);
                }

                
                if(resSME==null || (Array.isArray(resSME)==true && resSME.length==0)) {
                    process.exit(1);
                }

                // get all the hash for each keyspace
                let mult = redisClient.multi();
                for(let j=0;j<resSME.length;j++) {
                    mult.hgetall(chains[i].toUpperCase()+"::monitored::"+resSME[j]);
                }

                // execute the requests
                mult.exec((errMUL,resMUL)=>{
                    if(errMUL) {
                        console.error("Redis error:"+errMUL);
                        process.exit(1);
                    }

                    // build the text to display and send it to stdout
                    let output = "\033[0;34m====== \033[0;35mBLOCKCHAIN "+
                        chains[i].toUpperCase()+" \033[0;34m======\033[0m\n";
                    
                    for(let j=0;j<resMUL.length;j++) {
                        output += "\033[0;36m--- \033[0;35mKeyspace "+
                            resMUL[j].name+" \033[0m\n";
                        output += "\033[0;33mDelay\033[0m: "+ resMUL[j].delay+"\n";
                        output += "\033[0;33mLast block planned for update\033[0m: "+
                            resMUL[j].lastQueuedBlock+"\n";
                        output += "\033[0;33mHighest block ready:\033[0m: "+
                            resMUL[j].lastEnrichedBlock+"\n";
                        if(resMUL[j].hasOwnProperty("broken")==true && resMUL[j].broken==true) {
                            output += "\033[0;33mState:\033[0m: BROKEN\n";
                        } else {
                            output += "\033[0;33mState:\033[0m: HEALTHY\n";
                        }
                    }

                    console.log(output);
                    nbFinished++;
                    if(nbFinished==chains.length) {
                        process.exit(1);
                    }
                });
            });
        }
    });
}

module.exports = {exec_list_keyspaces};
const redis = require("redis");
const {segments_overlap} = require("./utils.js");

let redisClient;

const JOB_CHECK_INTERVAL = 5000;
let SYMBOL = null;
let KEYSPACE = null;
const MAX_DUPLICATE_LOOKAHEAD = 5000;

const jobStartedCallback = function() {};

function get_supported_chains() {
    return ["btc"];
}

const jobsSent = [];
let jobsTodo = [];
const jobsStatusMap = {};

let jobsPickedCount = 0;
let jobsErrorCount = 0;
let jobsDoneCount = 0;
let jobsTotalCount = 0;

// will store the mult to bulk job push
let initialJobsPush = null;

function register_ingestion_job(currency, keyspace, start, end) {
    // build the job name
    const jobname = keyspace+"::FILL_BLOCK_RANGE::"+start+","+end;

    // if this job is not already planned or another that is waiting for pickup
    if (job_overlaps(start, end)==false ) {
        initialJobsPush.lpush(currency.toUpperCase()+"::jobs::todo", jobname);
        // saving the job in an array
        // status will be: new - todo - doing - done - error
        jobsSent.push({
            name: jobname,
            start: start,
            end: end,
        });
        jobsStatusMap[jobname] = "new";
        jobsTotalCount++;

    // if the job was already planed
    } else {
        console.error("One of the job you were trying to push overlaps planned one for same keyspace: "+jobname);
        process.exit(1);
    }
}

function push_jobs() {
    return new Promise((resolve, reject)=>{
        initialJobsPush.exec((errMult, resMult)=>{
            // error management
            if (errMult) {
                reject(errMult);
                return;
            }
            resolve();
        });
    });
}

function job_overlaps(start, end) {
    // for each job (filtered by our keyspace)
    for (let i=0; i<jobsTodo.length; i++) {
    // check if range overlaps
        const range = jobsTodo[i].split("::")[2].split(",");
        if (segments_overlap(start, end, Number(range[0], Number(range[1])))==true) {
            return true;
        }
    }
    // if no overlap was found, return false
    return false;
}

// this function will save jobs to do (it will be required to avoid pushing duplicates)
function get_jobs_todo(currency) {
    return new Promise((resolve, reject)=>{
        redisClient.lrange(currency.toUpperCase()+"::jobs::todo", 0, MAX_DUPLICATE_LOOKAHEAD, (errLR, resLR)=>{
            if (errLR) {
                reject("REDIS ERROR WHILE QUERYING TODO JOBS:"+errLR);
                return;
            }

            if (resLR==null) {
                jobsTodo = [];
            } else {
                jobsTodo = resLR.filter((job) => job.startsWith(""+KEYSPACE+"::"));
            }
            resolve();
        });
    });
}

function prepare_redis_client(host, port, currency, keyspace) {
    return new Promise((resolve, reject)=>{
    // create clients
        redisClient = redis.createClient({host, port});
        subClient = redis.createClient({host, port});
        // kill everything in case of client errors
        redisClient.on("error", (err)=>{
            console.error("Unable to connect to redis client: "+err);
            process.exit(1);
        });
        // subscribe to error pub/sub
        subClient.subscribe(currency.toUpperCase()+"::errors");
        subClient.subscribe(currency.toUpperCase()+"::done");
        subClient.subscribe(currency.toUpperCase()+"::picked");
        // subscription to pub/subs callbacks
        subClient.on("message", (channel, message)=>{
            // redirect replicas errors to stdout
            if (channel==currency.toUpperCase()+"::errors") {
                donotclean=true;
                console.error("\033[0;31mREPLICA ERROR\033[0m: "+message);
                // if it's a job failing after it was marked as done (cassandra drivers ft. async - problems)
                if (message.indexOf("job failed to execute: ")!=-1) {
                    const jobelems = message.split("job failed to execute: ")[1].split("::");
                    jobelems.splice(2, 1);
                    const jobname = jobelems.join("::");
                    if (jobsStatusMap.hasOwnProperty(jobname)==true) {
                        if (jobsStatusMap[jobname]=="done") {
                            // decrease the done counter
                            jobsDoneCount--;
                        }
                        jobsErrorCount++;
                    }
                }
            }
            // monitor when our jobs get picked
            else if (channel==currency.toUpperCase()+"::picked") {
                if (jobsStatusMap.hasOwnProperty(message)==true) {
                    // if the job has been recovered, do not increment counter
                    if (jobsStatusMap[message]=="new") {
                        jobsPickedCount++;
                    }
                    jobsStatusMap[message]="picked";
                }
            } else if (channel==currency.toUpperCase()+"::done") {
                jobsStatusMap[message]="done";
                jobsDoneCount++;
            }
        });
        // save important values for later
        SYMBOL = currency;
        KEYSPACE = keyspace;

        // as soon as the redis client is ready
        redisClient.on("connect", ()=>{
            // create a mult to later bulk lpush calls
            initialJobsPush = redisClient.multi();
            resolve();
        });
    });
}

let previousDoneCount = 0;
let previousPickedCount = 0;
let previousErrorCount = 0;
let startedPicking = false;
let donotclean = false;
function monitor_jobs(stopSpinner) {
    setInterval(()=>{
        if (jobsDoneCount!=previousDoneCount ||
           jobsErrorCount!=previousErrorCount ||
           jobsPickedCount!=previousPickedCount) {
            if (startedPicking==false) {
                stopSpinner();
                startedPicking = true;
            }
            previousPickedCount = jobsPickedCount;
            previousDoneCount = jobsDoneCount;
            previousErrorCount = jobsErrorCount;
            if (donotclean==true) {
                clearLastLines(4);
                donotclean=false;
            }
            console.log("\033[0;34m====== \033[0;35mJOBS UPDATE \033[0;34m======\033[0m");
            console.log("\033[0;33mJobs Picked\033[0m: "+jobsPickedCount+" / "+jobsTotalCount);
            console.log("\033[0;33mJobs Finished\033[0m: "+jobsDoneCount+" / "+jobsTotalCount);
            console.log("\033[0;33mJobs Failed\033[0m: "+jobsErrorCount+" / "+jobsTotalCount);
            if (jobsDoneCount+jobsErrorCount >= jobsTotalCount ) {
                process.exit(0);
            }
        }
    }, 1000);
}

function clearLastLines(count) {
    process.stdout.moveCursor(0, -count);
    process.stdout.clearScreenDown();
}

module.exports = {get_supported_chains, register_ingestion_job, prepare_redis_client, get_jobs_todo, push_jobs, monitor_jobs};

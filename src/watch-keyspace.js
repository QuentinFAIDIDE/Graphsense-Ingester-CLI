process.title = "Graphsense BTC Ingester";

const blessed = require("blessed"); let screen;

const fs = require("fs");

const redis = require("redis");

const last_errors = [];
let date_last_error = 0;

function append_trim_errors(error) {
    date_last_error = Date.now();
    last_errors.push(error);
    if (last_errors.length > 200) {
        last_errors.splice(0, (last_errors.length - 200));
    }
}

function exec_watch_keyspace(args) {
    // initialize blessed library screen with flickering saving options
    screen = blessed.screen({smartCSR: true});

    // initialize redis
    const redisClient =
      redis.createClient({host: args.redis_host, port: args.port_redis});
    const subClient =
      redis.createClient({host: args.redis_host, port: args.port_redis});
    const currency = args.chain;
    const keyspace = args.keyspace;

    // create write stream if logs are activated
    let logStream;
    if (args.save_logs==true) {
        logStream = fs.createWriteStream("logs-"+Date.now()+".log", {flags: "a"});
    }

    // kill everything in case of client errors
    redisClient.on("error", (err) => {
        console.error("Unable to connect to redis client: " + err);
        process.exit(1);
    });
    subClient.subscribe(currency.toUpperCase() + "::errors");
    subClient.subscribe(currency.toUpperCase() + "::metrics");
    subClient.on("message", (channel, message) => {
        if (channel == (currency.toUpperCase() + "::errors")) {
            append_trim_errors(message);
            if (args.save_logs==true) {
                logStream.write(message+"\n");
            }
        } else if (channel == (currency.toUpperCase() + "::metrics")) {
            if (args.save_logs==true) {
                logStream.write(""+Date.now()+" "+message+"\n");
            }
        }
    });


    // if it is, then initialize UI
    // the box for the jobs todo
    const todo = blessed.listtable({
        top: 1,
        left: 0,
        width: "33%-1",
        height: "50%-1",
        tags: true,
        mouse: true,
        interactive: true,
        border: {type: "line"},
        style: {fg: "white", bg: "#101010", border: {fg: "#f0f0f0"}},
    });
    // the label for the box
    const label_todo = blessed.text({
        parent: screen,
        top: 0,
        height: 1,
        left: 1,
        width: "33%",
        align: "center",
        content: "PENDING JOBS STACK",
    });
    screen.append(label_todo);
    screen.append(todo);

    // doing stack
    const doing = blessed.listtable({
        top: 1,
        left: "33%",
        width: "33%",
        height: "50%-1",
        tags: true,
        mouse: true,
        interactive: true,
        border: {type: "line"},
        style: {fg: "white", bg: "#101010", border: {fg: "#f0f0f0"}},
    });
    // the label for the box
    const label_doing = blessed.text({
        parent: screen,
        top: 0,
        align: "center",
        height: 1,
        left: "33%+1",
        width: "33%",
        content: "PROCESSING JOBS STACK",
    });
    screen.append(label_doing);
    screen.append(doing);

    const label_infos = blessed.text({
        parent: screen,
        top: "50%",
        height: 1,
        left: 1,
        width: "33%",
        content: "KEYSPACE INFORMATIONS",
    });

    const infos = blessed.listtable({
        top: "50%+1",
        left: 0,
        width: "33%",
        height: "50%-1",
        tags: true,
        mouse: true,
        interactive: true,
        border: {type: "line"},
        style: {fg: "white", border: {fg: "#f0f0f0"}},
    });

    screen.append(label_infos);
    screen.append(infos);

    const label_done = blessed.text({
        parent: screen,
        top: 0,
        height: 1,
        left: "66%+1",
        width: "33%",
        content: "DONE JOBS STACK",
    });

    const done = blessed.listtable({
        top: 1,
        left: "66%",
        width: "33%",
        height: "50%-1",
        tags: true,
        mouse: true,
        interactive: true,
        border: {type: "line"},
        style: {fg: "white", bg: "#101010", selected: {}, border: {fg: "#f0f0f0"}},
    });

    screen.append(label_done);
    screen.append(done);

    // error stack
    const errors = blessed.listtable({
        top: "50%+1",
        left: "33%",
        width: "66%",
        height: "50%-1",
        tags: true,
        mouse: true,
        interactive: true,
        border: {type: "line"},
        style: {fg: "white", bg: "#101010", border: {fg: "#f0f0f0"}},
    });
    // the label for the box
    const label_errors = blessed.text({
        parent: screen,
        top: "50%",
        align: "center",
        height: 1,
        left: "33%+1",
        width: "66%",
        content: "ERROR STREAM (SEE SERVICE LOGS FOR MORE)",
    });
    screen.append(errors);
    screen.append(label_errors);

    // Quit on Escape, q, or Control-C.
    screen.key(["escape", "q", "C-c"], function(ch, key) {
        return process.exit(0);
    });

    // Render the screen.
    screen.render();

    // as soon as the redis client is ready
    redisClient.on("connect", () => {
    // update every 5 Seconds
        setInterval(() => {
            populateView(
                redisClient, currency, keyspace, screen, infos, todo, doing, done,
                errors);
        }, 500);

        populateView(
            redisClient, currency, keyspace, screen, infos, todo, doing, done,
            errors);
    });
}

// used to update the UI elements from the information retrieved in redis about
// keyspace/jobs
function populateView(
    redisClient, currency, keyspace, screen, infos, todo, doing, done, errors) {
    // bulk call with a redis mult
    const multi = redisClient.multi();

    // get jobs stacks (firest 100 elems only)
    multi.lrange(currency.toUpperCase() + "::jobs::todo", 0, 100);
    multi.lrange(currency.toUpperCase() + "::jobs::doing", 0, 100);
    multi.lrange(currency.toUpperCase() + "::jobs::done", 0, 100);
    multi.lrange(currency.toUpperCase() + "::jobs::errors", 0, 100);

    // get keyspace infos
    multi.hgetall(currency.toUpperCase() + "::monitored::" + keyspace);

    // get number of btc nodes
    multi.llen(currency + "::node-clients");

    // get stack lengths
    multi.llen(currency.toUpperCase() + "::jobs::todo");
    multi.llen(currency.toUpperCase() + "::jobs::doing");
    multi.llen(currency.toUpperCase() + "::jobs::errors");

    // get block and tx count
    multi.get(currency.toUpperCase() + "::" + keyspace + "::block-count");
    multi.get(currency.toUpperCase() + "::" + keyspace + "::tx-count");

    // get metrics
    multi.get(currency.toUpperCase() + "::metrics::avg-job-time");
    multi.get(currency.toUpperCase() + "::metrics::avg-block-time");
    multi.get(currency.toUpperCase() + "::metrics::redis-timeout");
    multi.get(currency.toUpperCase() + "::metrics::cassandra-timeout");
    multi.get(currency.toUpperCase() + "::metrics::master-routine-time");

    multi.exec((errEx, resEx) => {
        if (errEx) {
            console.log("Redis Error:" + errEx);
            process.exit(1);
        }

        // fill todo list
        todo.clearItems();
        if (resEx[0] != null) {
            for (let i = 0; i < resEx[0].length; i++) {
                if (resEx[0][i].indexOf("ENRICH_BLOCK_RANGE") == -1) {
                    todo.addItem("\033[0;35m" + resEx[0][i] + "\033[0m");
                } else {
                    todo.addItem("\033[0;32m" + resEx[0][i] + "\033[0m");
                }
            }
        }

        // fill doing list
        doing.clearItems();
        if (resEx[1] != null) {
            for (let i = 0; i < resEx[1].length; i++) {
                if (resEx[1][i].indexOf("ENRICH_BLOCK_RANGE") == -1) {
                    doing.addItem("\033[0;35m" + resEx[1][i] + "\033[0m");
                } else {
                    doing.addItem("\033[0;32m" + resEx[1][i] + "\033[0m");
                }
            }
        }

        // fill done list
        done.clearItems();
        if (resEx[2] != null) {
            for (let i = 0; i < resEx[2].length; i++) {
                if (resEx[2][i].indexOf("ENRICH_BLOCK_RANGE") == -1) {
                    done.addItem("\033[0;35m" + resEx[2][i] + "\033[0m");
                } else {
                    done.addItem("\033[0;32m" + resEx[2][i] + "\033[0m");
                }
            }
        }


        // fill errors list
        errors.clearItems();
        for (let i = last_errors.length - 1; i >= 0; i--) {
            errors.addItem(last_errors[i]);
        }

        // add infos
        infos.clearItems();

        let status;
        if (typeof resEx[4] == "undefined" || resEx[4]==null) {
            console.log("Keyspace not found.");
            process.exit(1);
        }

        if (resEx[4].hasOwnProperty("broken")==true && resEx[4].broken==true) {
            status = "broken";
        } else {
            status = "healthy";
        }

        infos.addItem("\033[0;32mKeyspace\033[0m: \033[0;31m" + keyspace + "\033[0m");
        infos.addItem("\033[0;32mKeyspace status\033[0m: \033[0;31m" + status + "\033[0m");
        infos.addItem("\033[0;32mBlocks in cassandra\033[0m: \033[0;31m" + resEx[9] + "\033[0m");
        infos.addItem("\033[0;32mTransactions in cassandra\033[0m: \033[0;31m" + resEx[10] + "\033[0m");
        infos.addItem("\033[0;32mLast Queued Block\033[0m: \033[0;31m" + resEx[4].lastQueuedBlock + "\033[0m");
        infos.addItem("\033[0;32mHighest block filled with data\033[0m: \033[0;31m" + resEx[4].lastFilledBlock + "\033[0m");
        infos.addItem("\033[0;32mHighest block enriched and ready\033[0m: \033[0;31m" + resEx[4].lastEnrichedBlock + "\033[0m");
        infos.addItem("\033[0;32mLast day with rate ingested\033[0m: \033[0;31m" + resEx[4].lastRatesWritten + "\033[0m");
        infos.addItem("\033[0;32mMinimum block depth before ingesting\033[0m: \033[0;31m" + resEx[4].delay + "\033[0m");
        infos.addItem("\033[0;32mBTC Nodes in use\033[0m: \033[0;31m" + resEx[5] + "\033[0m");
        infos.addItem("\033[0;32mJobs awaiting\033[0m: \033[0;31m" + resEx[6] + "\033[0m");
        infos.addItem("\033[0;32mJobs processing\033[0m: \033[0;31m" + resEx[7] + "\033[0m");
        infos.addItem("\033[0;32mJobs failed\033[0m: \033[0;31m" + resEx[8] + "\033[0m");
        infos.addItem("\033[0;32mAverage Job Time (ms)\033[0m: \033[0;31m" + resEx[11] + "\033[0m");
        infos.addItem("\033[0;32mAverage Block Time (ms)\033[0m: \033[0;31m" + resEx[12] + "\033[0m");
        infos.addItem("\033[0;32mMain Redis Resp Time (ms)\033[0m: \033[0;31m" + resEx[13] + "\033[0m");
        infos.addItem("\033[0;32mCassandra Resp Time (sec)\033[0m: \033[0;31m" + resEx[14] + "\033[0m");
        infos.addItem("\033[0;32mMaster Routine Time (ms)\033[0m: \033[0;31m" + resEx[15] + "\033[0m");


        screen.render();
    });
}

module.exports = {exec_watch_keyspace};

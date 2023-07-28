const errorLog = (e, customLog) => {
    onsole.log(e);
    console.log();
    console.log(customLog);
}

module.exports = { errorLog };
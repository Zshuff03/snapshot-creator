const errorLog = (e, customLog) => {
    console.log(e);
    console.log();
    console.log(customLog);
}

module.exports = { errorLog };
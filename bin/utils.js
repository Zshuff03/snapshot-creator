const errorLog = (e, customLog) => {
    console.log(e);
    console.log();
    console.log(customLog);
}

const getJsonStrWithUpdatedDependency = (jsonStr, packageName, newVersion) => {
    const dependencyRegex = new RegExp(`("${packageName}"\\s*:\\s*")[^"]*(")`);
    return jsonStr.replace(dependencyRegex, `$1${newVersion}$2`);
};

const getJsonStrWithUpdatedVersion = (jsonStr, newVersion) => {
    const versionRegex = /("version"\s*:\s*")[^"]*(")/;
    return jsonStr.replace(versionRegex, `$1${newVersion}$2`);
};

module.exports = {
    errorLog,
    getJsonStrWithUpdatedDependency,
    getJsonStrWithUpdatedVersion
};
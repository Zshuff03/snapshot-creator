const errorLog = (e, customLog) => {
    console.log(e);
    console.log();
    console.log(customLog);
}

const getJsonStrWithUpdatedDependency = (jsonStr, packageName, newVersion, section = 'dependencies') => {
    // matches the dependency within the specific section
    const sectionRegex = new RegExp(`("${section}"\\s*:\\s*{[^}]*?"${packageName}"\\s*:\\s*")[^"]*(")`);
    return jsonStr.replace(sectionRegex, `$1${newVersion}$2`);
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
#! /usr/bin/env node
const yargs = require("yargs");
const utils = require('./utils.js');
const fs = require('fs');
var beautify = require("json-beautify");
const runtimeDirectory = process.cwd();

const createSnapshot = (gitHash) => {
    let packageJson = null;
    try {
        packageJson = require(`${runtimeDirectory}/package.json`);
    } catch(e) {
        utils.errorLog(e, 'Oops! Can\'t seem to find your package json.');
    }

    if (packageJson) {
        const currentVer = packageJson.version;
        if((currentVer.toLowerCase()).indexOf('snapshot') === -1) {
            console.log('Creating brand new snapshot...');
            const dashSegments = currentVer.split('-');
            const version = dashSegments[0].split('.');

            console.log('Bumping minor version...');
            version[1] = `${parseInt(version[1]) + 1}`;

            console.log('Stitching snapshot version back together...');
            packageJson.version = `${version[0]}.${version[1]}.0-${gitHash}-SNAPSHOT`;
        } else {
            console.log('Previous snapshot found!');
            const dashSegments = currentVer.split('-');

            console.log('Replacing hash...');
            packageJson.version = `${dashSegments[0]}-${gitHash}-SNAPSHOT`;
        }

        try {
            fs.writeFile(`${runtimeDirectory}/package.json`, `${beautify(packageJson, null, 2, 60)}\n`, {}, () => {});
        } catch(e) {
            utils.errorLog(e, 'Oops! Can\'t seem to write the changes back to your package.json');
        }
    }
}

const extractLatestGitRevisionHash = () => {
    return revision = require('child_process')
        .execSync('git rev-parse HEAD')
        .toString().trim();
}

const mainFunc = (argv) => {
    try {
        const gitHash = extractLatestGitRevisionHash();
        createSnapshot(gitHash);
    } catch(e) {
        utils.errorLog(e, 'An error has occurred. You man not currently be using this command in a git repo');
    }
    console.log('Success!');
}

const usage = "\nUsage: tran <lang_name> sentence to be translated";
const options = yargs
    .usage(usage)
    .command(['build', 'create', '$0'], 'Create and add a new snapshot version to the package.json for the git repo are currently in!', () => {}, mainFunc)
    .help(true)  
    .argv;
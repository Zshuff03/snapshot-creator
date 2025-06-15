#! /usr/bin/env node
const yargs = require("yargs");
const utils = require('./utils.js');
const fs = require('fs');
const path = require('path');
const runtimeDirectory = process.cwd();

// Workspace functionality
const WORKSPACE_FILE = path.join(require('os').homedir(), '.snapshot-creator-workspace.json');

const initWorkspace = () => {
    if (!fs.existsSync(WORKSPACE_FILE)) {
        const initialWorkspace = {
            packages: [],
            created: new Date().toISOString()
        };
        try {
            fs.writeFileSync(WORKSPACE_FILE, JSON.stringify(initialWorkspace, null, 2));
            console.log('Workspace initialized successfully!');
        } catch(e) {
            utils.errorLog(e, 'Failed to initialize workspace file');
        }
    }
    return loadWorkspace();
}

const loadWorkspace = () => {
    try {
        if (fs.existsSync(WORKSPACE_FILE)) {
            return JSON.parse(fs.readFileSync(WORKSPACE_FILE, 'utf8'));
        }
        return initWorkspace();
    } catch(e) {
        utils.errorLog(e, 'Failed to load workspace file');
        return null;
    }
}

const saveWorkspace = (workspace) => {
    try {
        fs.writeFileSync(WORKSPACE_FILE, JSON.stringify(workspace, null, 2));
        return true;
    } catch(e) {
        utils.errorLog(e, 'Failed to save workspace file');
        return false;
    }
}

const addToWorkspaceAfterPublish = (packageJson, gitHash) => {
    const workspace = initWorkspace();
    if (!workspace) return false;

    const packageEntry = {
        name: packageJson.name,
        version: packageJson.version,
        gitHash: gitHash,
        path: runtimeDirectory,
        timestamp: new Date().toISOString(),
        description: packageJson.description || '',
        published: true
    };

    // Check if package already exists and update it, or add new entry
    const existingIndex = workspace.packages.findIndex(pkg =>
        pkg.name === packageEntry.name && pkg.path === packageEntry.path
    );

    if (existingIndex >= 0) {
        workspace.packages[existingIndex] = packageEntry;
        console.log(`Updated ${packageEntry.name} in workspace`);
    } else {
        workspace.packages.push(packageEntry);
        console.log(`Added ${packageEntry.name} to workspace`);
    }

    if (saveWorkspace(workspace)) {
        console.log('Workspace saved successfully!');
        return true;
    }
    return false;
}

const publishToWorkspace = (argv) => {
    let packageJson = null;
    try {
        packageJson = require(`${runtimeDirectory}/package.json`);
    } catch(e) {
        utils.errorLog(e, 'Oops! Can\'t seem to find your package.json in current directory.');
        return;
    }

    console.log(`Publishing ${packageJson.name}@${packageJson.version}...`);

    try {
        // Attempt to publish the package
        const publishResult = require('child_process')
            .execSync('npm publish', {
                cwd: runtimeDirectory,
                stdio: 'pipe',
                encoding: 'utf8'
            });

        console.log('✅ Package published successfully!');
        console.log(publishResult);

        // Only add to workspace after successful publish
        const gitHash = extractLatestGitRevisionHash();
        if (addToWorkspaceAfterPublish(packageJson, gitHash)) {
            console.log('✅ Package added to workspace!');
        } else {
            console.log('⚠️  Package published but failed to add to workspace');
        }

    } catch(e) {
      if (e.stdout) {
        console.log('npm output:', e.stdout);
      }
      if (e.stderr) {
        console.log('npm error:', e.stderr);
      }
      utils.errorLog(e, 'Package was not added to workspace due to publish failure');
      console.log('❌ Failed to publish package');
    }
}

const listWorkspace = (argv) => {
    const workspace = loadWorkspace();
    if (!workspace || !workspace.packages || workspace.packages.length === 0) {
        console.log('Workspace is empty. Use "ss workspace publish" to publish and add packages.');
        return;
    }

    console.log('\n=== Snapshot Creator Workspace ===');
    console.log(`Total packages: ${workspace.packages.length}`);
    console.log(`Workspace created: ${new Date(workspace.created).toLocaleDateString()}\n`);

    workspace.packages.forEach((pkg, index) => {
        console.log(`${index + 1}. ${pkg.name}`);
        console.log(`   Version: ${pkg.version}`);
        console.log(`   Git Hash: ${pkg.gitHash.substring(0, 8)}...`);
        console.log(`   Path: ${pkg.path}`);
        console.log(`   Added: ${new Date(pkg.timestamp).toLocaleString()}`);
        console.log(`   Published: ${pkg.published ? '✅ Yes' : '❌ No'}`);
        if (pkg.description) {
            console.log(`   Description: ${pkg.description}`);
        }
        console.log('');
    });
}

const clearWorkspace = (argv) => {
    try {
        if (fs.existsSync(WORKSPACE_FILE)) {
            fs.unlinkSync(WORKSPACE_FILE);
            console.log('Workspace cleared successfully!');
        } else {
            console.log('No workspace file found to clear.');
        }
    } catch(e) {
        utils.errorLog(e, 'Failed to clear workspace');
    }
}

const createSnapshot = (gitHash) => {
    let packageJson = null;
    let originalJsonStr = '';
    try {
        originalJsonStr = fs.readFileSync(`${runtimeDirectory}/package.json`);
        packageJson = JSON.parse(originalJsonStr);
    } catch(e) {
        utils.errorLog(e, 'Oops! Can\'t seem to find your package json.');
        return;
    }

    if (packageJson) {
        const currentVer = packageJson.version;
        let newVersion = '';

        if((currentVer.toLowerCase()).indexOf('snapshot') === -1) {
            console.log('Creating brand new snapshot...');
            const dashSegments = currentVer.split('-');
            const version = dashSegments[0].split('.');

            console.log('Bumping minor version...');
            version[1] = `${parseInt(version[1]) + 1}`;

            console.log('Stitching snapshot version back together...');
            newVersion = `${version[0]}.${version[1]}.0-${gitHash}-SNAPSHOT`;
        } else {
            console.log('Previous snapshot found!');
            const dashSegments = currentVer.split('-');

            console.log('Replacing hash...');
            newVersion = `${dashSegments[0]}-${gitHash}-SNAPSHOT`;
        }

        try {
            fs.writeFileSync(`${runtimeDirectory}/package.json`, utils.getJsonStrWithUpdatedVersion(originalJsonStr, newVersion));
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
        console.log('Success!');
    } catch(e) {
        utils.errorLog(e, 'An error has occurred. You may not currently be using this command in a git repo');
    }
}

const syncWorkspace = (argv) => {
    let packageJson = null;
    let originalJsonStr = '';
    try {
        originalJsonStr = fs.readFileSync(`${runtimeDirectory}/package.json`);
        packageJson = JSON.parse(originalJsonStr);
    } catch(e) {
        utils.errorLog(e, 'Oops! Can\'t seem to find your package.json in current directory.');
        return;
    }

    const workspace = loadWorkspace();
    if (!workspace || !workspace.packages || workspace.packages.length === 0) {
        console.log('Workspace is empty. Use "ss workspace publish" to publish and add packages first.');
        return;
    }

    console.log(`Syncing dependencies for ${packageJson.name}...`);

    // Create a map of workspace packages for quick lookup
    const workspacePackages = {};
    workspace.packages.forEach(pkg => {
        workspacePackages[pkg.name] = pkg.version;
    });

    let updatedCount = 0;
    let skippedCount = 0;
    const updateResults = [];
    let updatedJsonStr = originalJsonStr;

    // Helper function to update dependencies in a specific section
    const updateDependencySection = (sectionName, dependencies) => {
        if (!dependencies) return;

        Object.keys(dependencies).forEach(depName => {
            if (workspacePackages[depName]) {
                const oldVersion = dependencies[depName];
                const newVersion = workspacePackages[depName];

                if (oldVersion !== newVersion) {
                    updatedJsonStr = utils.getJsonStrWithUpdatedDependency(updatedJsonStr, depName, newVersion, sectionName);
                    updatedCount++;
                    updateResults.push({
                        name: depName,
                        section: sectionName,
                        oldVersion,
                        newVersion
                    });
                    console.log(`  📦 ${depName}: ${oldVersion} → ${newVersion} (${sectionName})`);
                } else {
                    skippedCount++;
                    console.log(`  ✅ ${depName}: already at ${newVersion} (${sectionName})`);
                }
            }
        });
    };

    // Update all dependency sections
    updateDependencySection('dependencies', packageJson.dependencies);
    updateDependencySection('devDependencies', packageJson.devDependencies);
    updateDependencySection('peerDependencies', packageJson.peerDependencies);
    updateDependencySection('optionalDependencies', packageJson.optionalDependencies);

    if (updatedCount === 0 && skippedCount === 0) {
        console.log('No matching packages found in workspace for current dependencies.');
        return;
    }

    if (updatedCount > 0) {
        try {
            // Write the updated jsonStr back to package.json
            fs.writeFileSync(`${runtimeDirectory}/package.json`, updatedJsonStr);
            console.log(`\n✅ Successfully updated ${updatedCount} dependencies!`);

            if (skippedCount > 0) {
                console.log(`ℹ️  ${skippedCount} dependencies were already up to date.`);
            }

            console.log('\n📋 Summary of changes:');
            updateResults.forEach(result => {
                console.log(`   ${result.name} (${result.section}): ${result.oldVersion} → ${result.newVersion}`);
            });

            console.log('\n💡 Don\'t forget to run "npm install" to install the updated dependencies.');

        } catch(e) {
            utils.errorLog(e, 'Failed to write updated package.json');
        }
    } else {
        console.log(`\n✅ All ${skippedCount} matching dependencies are already up to date!`);
    }
}

const addToWorkspace = (argv) => {
    let packageJson = null;
    try {
        packageJson = require(`${runtimeDirectory}/package.json`);
    } catch(e) {
        utils.errorLog(e, 'Oops! Can\'t seem to find your package.json in current directory.');
        return;
    }

    const workspace = initWorkspace();
    if (!workspace) return;

    const gitHash = extractLatestGitRevisionHash();
    const packageEntry = {
        name: packageJson.name,
        version: packageJson.version,
        gitHash: gitHash,
        path: runtimeDirectory,
        timestamp: new Date().toISOString(),
        description: packageJson.description || '',
        published: false
    };

    // Check if package already exists and update it, or add new entry
    const existingIndex = workspace.packages.findIndex(pkg =>
        pkg.name === packageEntry.name && pkg.path === packageEntry.path
    );

    if (existingIndex >= 0) {
        workspace.packages[existingIndex] = packageEntry;
        console.log(`Updated ${packageEntry.name} in workspace`);
    } else {
        workspace.packages.push(packageEntry);
        console.log(`Added ${packageEntry.name} to workspace`);
    }

    if (saveWorkspace(workspace)) {
        console.log('Workspace saved successfully!');
    }
}

const usage = "\nUsage: ss <command> [options]";
const options = yargs
    .usage(usage)
    .command(['build', 'create', '$0'], 'Create and add a new snapshot version to the package.json for the git repo you are currently in!', () => {}, mainFunc)
    .command(['publish'], 'Publish current package to npm and add to workspace on success', () => {}, publishToWorkspace)
    .command('workspace', 'Manage your snapshot workspace', (yargs) => {
        return yargs
            .command('publish', 'Publish current package to npm and add to workspace on success', () => {}, publishToWorkspace)
            .command('list', 'List all packages in workspace', () => {}, listWorkspace)
            .command('clear', 'Clear the workspace', () => {}, clearWorkspace)
            .command('sync', 'Sync workspace versions to package.json dependencies', () => {}, syncWorkspace)
            .command('add', 'Add current package to workspace without publishing', () => {}, addToWorkspace)
            .demandCommand(1, 'You need to specify a workspace command (publish, list, clear, sync, or add)')
            .help();
    })
    .help(true)
    .argv;

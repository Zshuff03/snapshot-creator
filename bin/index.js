#! /usr/bin/env node
const yargs = require("yargs");
const utils = require('./utils.js');
const fs = require('fs');
const path = require('path');
const runtimeDirectory = process.cwd();

// Workspace functionality
const WORKSPACES_DIR = path.join(require('os').homedir(), '.snapshot-creator');
const WORKSPACES_CONFIG_FILE = path.join(WORKSPACES_DIR, 'config.json');
const DEFAULT_WORKSPACE = 'default';

const ensureWorkspacesDirectory = () => {
    if (!fs.existsSync(WORKSPACES_DIR)) {
        fs.mkdirSync(WORKSPACES_DIR, { recursive: true });
    }
};

const loadWorkspacesConfig = () => {
    try {
        if (fs.existsSync(WORKSPACES_CONFIG_FILE)) {
            return JSON.parse(fs.readFileSync(WORKSPACES_CONFIG_FILE, 'utf8'));
        }
        return {
            currentWorkspace: DEFAULT_WORKSPACE,
            workspaces: {},
            created: new Date().toISOString()
        };
    } catch(e) {
        utils.errorLog(e, 'Failed to load workspaces config');
        return null;
    }
};

const saveWorkspacesConfig = (config) => {
    try {
        ensureWorkspacesDirectory();
        fs.writeFileSync(WORKSPACES_CONFIG_FILE, JSON.stringify(config, null, 2));
        return true;
    } catch(e) {
        utils.errorLog(e, 'Failed to save workspaces config');
        return false;
    }
};

const getWorkspaceFilePath = (workspaceName) => {
    return path.join(WORKSPACES_DIR, `${workspaceName}.json`);
};

const initWorkspace = (workspaceName = null) => {
    const config = loadWorkspacesConfig();
    if (!config) return null;

    const wsName = workspaceName || config.currentWorkspace || DEFAULT_WORKSPACE;
    const workspaceFile = getWorkspaceFilePath(wsName);
    
    if (!fs.existsSync(workspaceFile)) {
        const initialWorkspace = {
            name: wsName,
            packages: [],
            created: new Date().toISOString()
        };
        try {
            ensureWorkspacesDirectory();
            fs.writeFileSync(workspaceFile, JSON.stringify(initialWorkspace, null, 2));
            
            config.workspaces[wsName] = {
                name: wsName,
                created: initialWorkspace.created,
                lastModified: initialWorkspace.created
            };
            
            if (!config.currentWorkspace) {
                config.currentWorkspace = wsName;
            }
            
            saveWorkspacesConfig(config);
            console.log(`Workspace '${wsName}' initialized successfully!`);
        } catch(e) {
            utils.errorLog(e, `Failed to initialize workspace '${wsName}'`);
            return null;
        }
    }
    return loadWorkspace(wsName);
};

const loadWorkspace = (workspaceName = null) => {
    try {
        const config = loadWorkspacesConfig();
        if (!config) return null;

        const wsName = workspaceName || config.currentWorkspace || DEFAULT_WORKSPACE;
        const workspaceFile = getWorkspaceFilePath(wsName);
        
        if (fs.existsSync(workspaceFile)) {
            return JSON.parse(fs.readFileSync(workspaceFile, 'utf8'));
        }
        return initWorkspace(wsName);
    } catch(e) {
        utils.errorLog(e, `Failed to load workspace '${workspaceName || 'current'}'`);
        return null;
    }
};

const saveWorkspace = (workspace, workspaceName = null) => {
    try {
        const config = loadWorkspacesConfig();
        if (!config) return false;

        const wsName = workspaceName || workspace.name || config.currentWorkspace || DEFAULT_WORKSPACE;
        const workspaceFile = getWorkspaceFilePath(wsName);
        
        workspace.name = wsName;
        workspace.lastModified = new Date().toISOString();
        
        ensureWorkspacesDirectory();
        fs.writeFileSync(workspaceFile, JSON.stringify(workspace, null, 2));
        
        config.workspaces[wsName] = {
            name: wsName,
            created: workspace.created || new Date().toISOString(),
            lastModified: workspace.lastModified
        };
        saveWorkspacesConfig(config);
        
        return true;
    } catch(e) {
        utils.errorLog(e, `Failed to save workspace '${workspaceName || 'current'}'`);
        return false;
    }
};

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
        console.log(`Updated ${packageEntry.name} in workspace '${workspace.name}'`);
    } else {
        workspace.packages.push(packageEntry);
        console.log(`Added ${packageEntry.name} to workspace '${workspace.name}'`);
    }

    if (saveWorkspace(workspace)) {
        console.log('Workspace saved successfully!');
        return true;
    }
    return false;
};

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
    const config = loadWorkspacesConfig();
    if (!config) return;

    const workspaceName = argv.name || config.currentWorkspace || DEFAULT_WORKSPACE;
    const workspace = loadWorkspace(workspaceName);
    
    if (!workspace || !workspace.packages || workspace.packages.length === 0) {
        console.log(`Workspace '${workspaceName}' is empty. Use "ss workspace publish" to publish and add packages.`);
        return;
    }

    console.log(`\n=== Workspace: ${workspaceName} ===`);
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
};

const clearWorkspace = (argv) => {
    const config = loadWorkspacesConfig();
    if (!config) return;

    const workspaceName = argv.name || config.currentWorkspace || DEFAULT_WORKSPACE;
    const workspaceFile = getWorkspaceFilePath(workspaceName);
    
    try {
        if (fs.existsSync(workspaceFile)) {
            fs.unlinkSync(workspaceFile);
            
            delete config.workspaces[workspaceName];
            
            // if this was the current workspace, switch to default or first available
            if (config.currentWorkspace === workspaceName) {
                const remainingWorkspaces = Object.keys(config.workspaces);
                config.currentWorkspace = remainingWorkspaces.length > 0 ? remainingWorkspaces[0] : DEFAULT_WORKSPACE;
            }
            
            saveWorkspacesConfig(config);
            console.log(`Workspace '${workspaceName}' cleared successfully!`);
        } else {
            console.log(`No workspace '${workspaceName}' found to clear.`);
        }
    } catch(e) {
        utils.errorLog(e, `Failed to clear workspace '${workspaceName}'`);
    }
};

const createWorkspace = (argv) => {
    if (!argv.name) {
        console.log('Error: Workspace name is required. Use: ss workspace create --name <workspace-name>');
        return;
    }

    const config = loadWorkspacesConfig();
    if (!config) return;

    const workspaceName = argv.name;
    
    if (config.workspaces[workspaceName]) {
        console.log(`Workspace '${workspaceName}' already exists.`);
        return;
    }

    const workspace = initWorkspace(workspaceName);
    if (workspace) {
        console.log(`✅ Workspace '${workspaceName}' created successfully!`);
    }
};

const switchWorkspace = (argv) => {
    if (!argv.name) {
        console.log('Error: Workspace name is required. Use: ss workspace use --name <workspace-name>');
        return;
    }

    const config = loadWorkspacesConfig();
    if (!config) return;

    const workspaceName = argv.name;
    const workspaceFile = getWorkspaceFilePath(workspaceName);
    
    if (!fs.existsSync(workspaceFile)) {
        console.log(`Workspace '${workspaceName}' does not exist. Available workspaces:`);
        listWorkspaces();
        return;
    }

    config.currentWorkspace = workspaceName;
    if (saveWorkspacesConfig(config)) {
        console.log(`✅ Switched to workspace '${workspaceName}'`);
    }
};

const getCurrentWorkspace = (argv) => {
    const config = loadWorkspacesConfig();
    if (!config) return;

    const currentWs = config.currentWorkspace || DEFAULT_WORKSPACE;
    console.log(`Current workspace: ${currentWs}`);
};

const listWorkspaces = (argv) => {
    const config = loadWorkspacesConfig();
    if (!config) return;

    const workspaceNames = Object.keys(config.workspaces);
    
    if (workspaceNames.length === 0) {
        console.log('No workspaces found. Use "ss workspace create --name <name>" to create one.');
        return;
    }

    console.log('\n=== Available Workspaces ===');
    workspaceNames.forEach(name => {
        const isCurrent = name === config.currentWorkspace;
        const workspace = config.workspaces[name];
        const marker = isCurrent ? '* ' : '  ';
        console.log(`${marker}${name} (created: ${new Date(workspace.created).toLocaleDateString()})`);
    });
    console.log('');
};

const createSnapshot = (gitHash, includeWorkspace = false) => {
    let packageJson = null;
    let originalJsonStr = '';
    try {
        originalJsonStr = fs.readFileSync(`${runtimeDirectory}/package.json`, 'utf8');
        packageJson = JSON.parse(originalJsonStr);
    } catch(e) {
        utils.errorLog(e, 'Oops! Can\'t seem to find your package json.');
        return;
    }

    let workspaceSlug = '';
    if (includeWorkspace) {
        const config = loadWorkspacesConfig();
        const workspaceName = config?.currentWorkspace || DEFAULT_WORKSPACE;
        workspaceSlug = `-${workspaceName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
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
            newVersion = `${version[0]}.${version[1]}.0-${gitHash}${workspaceSlug}-SNAPSHOT`;
        } else {
            console.log('Previous snapshot found!');
            const dashSegments = currentVer.split('-');
            
            console.log('Replacing hash...');
            newVersion = `${dashSegments[0]}-${gitHash}${workspaceSlug}-SNAPSHOT`;
        }

        if (includeWorkspace) {
            const config = loadWorkspacesConfig();
            const workspaceName = config?.currentWorkspace || DEFAULT_WORKSPACE;
            console.log(`Creating snapshot for workspace '${workspaceName}': ${newVersion}`);
        } else {
            console.log(`Creating snapshot: ${newVersion}`);
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
        createSnapshot(gitHash, argv.workspace || argv.w);
        console.log('Success!');
    } catch(e) {
        utils.errorLog(e, 'An error has occurred. You may not currently be using this command in a git repo');
    }
}

const syncWorkspace = (argv) => {
    let packageJson = null;
    let originalJsonStr = '';
    try {
        originalJsonStr = fs.readFileSync(`${runtimeDirectory}/package.json`, 'utf8');
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
        console.log(`Updated ${packageEntry.name} in workspace '${workspace.name}'`);
    } else {
        workspace.packages.push(packageEntry);
        console.log(`Added ${packageEntry.name} to workspace '${workspace.name}'`);
    }

    if (saveWorkspace(workspace)) {
        console.log('Workspace saved successfully!');
    }
};

const usage = "\nUsage: ss <command> [options]";
const options = yargs
    .usage(usage)
    .command(['build', 'create', '$0'], 'Create and add a new snapshot version to the package.json for the git repo you are currently in!', (yargs) => {
        return yargs.option('workspace', {
            alias: 'w',
            describe: 'Include workspace name in the snapshot version',
            type: 'boolean',
            default: false
        });
    }, mainFunc)
    .command(['publish'], 'Publish current package to npm and add to workspace on success', () => {}, publishToWorkspace)
    .command(['workspace', 'ws'], 'Manage your snapshot workspaces', (yargs) => {
        return yargs
            .command('publish', 'Publish current package to npm and add to workspace on success', () => {}, publishToWorkspace)
            .command('list', 'List all packages in current workspace', (yargs) => {
                return yargs.option('name', {
                    alias: 'n',
                    describe: 'Workspace name to list (defaults to current workspace)',
                    type: 'string'
                });
            }, listWorkspace)
            .command('clear', 'Clear a workspace', (yargs) => {
                return yargs.option('name', {
                    alias: 'n',
                    describe: 'Workspace name to clear (defaults to current workspace)',
                    type: 'string'
                });
            }, clearWorkspace)
            .command('sync', 'Sync workspace versions to package.json dependencies', () => {}, syncWorkspace)
            .command('add', 'Add current package to workspace without publishing', () => {}, addToWorkspace)
            .command('create', 'Create a new workspace', (yargs) => {
                return yargs.option('name', {
                    alias: 'n',
                    describe: 'Name of the workspace to create',
                    type: 'string',
                    demandOption: true
                });
            }, createWorkspace)
            .command('use', 'Switch to a different workspace', (yargs) => {
                return yargs.option('name', {
                    alias: 'n',
                    describe: 'Name of the workspace to switch to',
                    type: 'string',
                    demandOption: true
                });
            }, switchWorkspace)
            .command('current', 'Show current workspace', () => {}, getCurrentWorkspace)
            .command('ls', 'List all available workspaces', () => {}, listWorkspaces)
            .demandCommand(1, 'You need to specify a workspace command')
            .help();
    })
    .help(true)
    .argv;

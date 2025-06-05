Hello and welcome to a CLI tool that will (hopefully) save you some time!

This is tool is built to automatically update your package.json with a 'snapshot' version for safe publishing and testing of npm packages within other packages.

Just install the package globally with this command: `npm i snapshot-creator -g` and then use the `ss` command to run. It should detect whether or not you already have a snapshot version, and if you do, change the git hash to your most recent one. If it doesn't detect an existing snapshot, it will bump the minor versioning of the package, and create one for you!

## Commands

### Creating Snapshots
- `ss` or `ss build` or `ss create` - Create a snapshot version for the current package

### Workspace Management
The workspace feature allows you to track published packages across different projects.

- `ss workspace add` - Add the current package to your workspace without publishing
- `ss workspace publish` - Publish the current package to npm and add it to your workspace on successful publish
- `ss workspace list` - List all packages saved in your workspace  
- `ss workspace sync` - Update current package.json dependencies to match workspace versions
- `ss workspace clear` - Clear all packages from your workspace

The workspace data is stored in `~/.snapshot-creator-workspace.json` and persists across different projects and terminal sessions. Packages added with `publish` are marked as published, while those added with `add` are marked as unpublished.

## Usage Examples

```bash
# Create a snapshot for current package
ss

# Add current package to workspace without publishing
ss workspace add

# Publish current package to npm and add to workspace
ss workspace publish

# View all packages in workspace
ss workspace list

# Update current package.json dependencies to workspace versions
ss workspace sync

# Clear workspace
ss workspace clear
```

Happy snapshotting!

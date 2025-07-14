Hello and welcome to a CLI tool that will (hopefully) save you some time!

This is tool is built to automatically update your package.json with a 'snapshot' version for safe publishing and testing of npm packages within other packages.

Just install the package globally with this command: `npm i snapshot-creator -g` and then use the `ss` command to run. It should detect whether or not you already have a snapshot version, and if you do, change the git hash to your most recent one. If it doesn't detect an existing snapshot, it will bump the minor versioning of the package, and create one for you!

## Commands

### Creating Snapshots
- `ss` or `ss build` or `ss create` - Create a snapshot version for the current package
- `ss --workspace` or `ss -w` - Create a snapshot version that includes the current workspace name as a slug (e.g., `2.1.0-hash-FV-1234-SNAPSHOT`)

### Workspace Management
The workspace feature allows you to manage multiple named workspaces to track published packages across different projects and environments.

#### Basic Workspace Commands
- `ss workspace add` - Add the current package to your current workspace without publishing
- `ss workspace publish` - Publish the current package to npm and add it to your current workspace on successful publish
- `ss workspace list` - List all packages in the current workspace
- `ss workspace list --name <workspace>` - List all packages in a specific workspace
- `ss workspace sync` - Update current package.json dependencies to match current workspace versions
- `ss workspace clear` - Clear all packages from the current workspace
- `ss workspace clear --name <workspace>` - Clear all packages from a specific workspace

#### Multi-Workspace Management
- `ss workspace create --name <workspace>` - Create a new workspace
- `ss workspace use --name <workspace>` - Switch to a different workspace
- `ss workspace current` - Show the current active workspace
- `ss workspace ls` - List all available workspaces

The workspace data is stored in `~/.snapshot-creator/` directory with separate files for each workspace and a config file to track the current workspace. This allows you to maintain separate package collections for different projects or tickets (e.g. FV-1234).

## Usage Examples

```bash
# Create a snapshot for current package
ss

# Create a snapshot with workspace name included
ss --workspace
# or
ss -w

# Create and manage workspaces
ss workspace create --name development
ss workspace create --name production
ss workspace ls                    # List all workspaces
ss workspace current              # Show current workspace
ss workspace use --name development

# Add current package to current workspace without publishing
ss workspace add

# Publish current package to npm and add to current workspace
ss workspace publish

# View all packages in current workspace
ss workspace list

# View packages in a specific workspace
ss workspace list --name production

# Update current package.json dependencies to current workspace versions
ss workspace sync

# Clear current workspace
ss workspace clear

# Clear a specific workspace
ss workspace clear --name development
```

Happy snapshotting!

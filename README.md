Hello and welcome to a CLI tool that will (hopefully) save you some time!

This is tool is built to automatically update your package.json with a 'snapshot' version for safe publishing and testing of npm packages within other packages.

Simply install this package globally and use the `ss` command to run. It should detect whether or not you already have a snapshot version, and if you do, change the git hash to your most recent one. If it doesn't detect an existing snapshot, it will bump the minor versioning of the package, and create one for you!

Happy snapshotting!
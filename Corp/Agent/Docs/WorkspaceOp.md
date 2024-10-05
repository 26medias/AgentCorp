# WorkspaceOp Documentation

## Overview

The `WorkspaceOp` class provides utility methods to work with files and execute shell commands within a specified workspace directory. This is useful for managing a collection of files and automating tasks in a specific folder structure. The class supports reading and writing files, as well as running shell commands.

## Class: WorkspaceOp

### Constructor

**WorkspaceOp(workspaceDir)**
- **workspaceDir**: The directory to use as the workspace.
	
Creates a new instance of the `WorkspaceOp` class with the specified workspace directory.

### Methods

#### readFile(relativePath)

**Parameters**:
- **relativePath**: The relative path to the file.

**Returns**: `Promise<string>`
- Returns the content of the file if found, otherwise returns `"[not found]"` or an error message in the format `"[error: {error_message}]"`.

Reads the content of a file in the workspace directory specified by `relativePath`.

#### writeFile(relativePath, content)

**Parameters**:
- **relativePath**: The relative path to the file.
- **content**: The content to write to the file.

**Returns**: `Promise<boolean|string>`
- Returns `true` if the file was written successfully, or an error message in the format `"[error: {error_message}]"` if there was an error.

Writes the specified content to a file in the workspace directory.

#### runShellCommand(relativeDir, command)

**Parameters**:
- **relativeDir**: The relative directory within the workspace to run the command.
- **command**: The shell command to execute.

**Returns**: `Promise<string>`
- Returns the output of the command, or an error message in the format `"[error: {error_message}]"` if it fails.

Runs the specified shell command in a directory within the workspace directory.

## Example Usage

	const WorkspaceOp = require('./WorkspaceOp');

	(async () => {
	    const workspace = new WorkspaceOp('./workspace_directory');
	    
	    // Reading a file
	    const fileContent = await workspace.readFile('./filename');
	    console.log(fileContent); // Outputs file content or error message

	    // Writing to a file
	    const writeResult = await workspace.writeFile('./filename', 'Hello, World!');
	    console.log(writeResult); // Outputs true or error message

	    // Running a shell command
	    const cmdOutput = await workspace.runShellCommand('./directory', 'npm install');
	    console.log(cmdOutput); // Outputs command output or error message
	})();

## Notes
- Ensure that the workspace directory and relative paths exist and have the necessary permissions.
- The `runShellCommand` method should be used with caution to avoid executing potentially harmful commands.
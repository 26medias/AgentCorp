import { promises as fs } from 'fs';
import path from 'path';
import { exec } from 'child_process';

class WorkspaceOp {
    /**
     * Create a new WorkspaceOp instance.
     * @param {string} workspaceDir - The directory to use as the workspace.
     */
    constructor(workspaceDir) {
        this.workspaceDir = workspaceDir;
    }

    /**
     * Read the content of a file in the workspace directory.
     * @param {string} relativePath - The relative path to the file.
     * @returns {Promise<string>} - The content of the file, or an error message if not found.
     */
    async readFile(relativePath) {
        const fullPath = path.join(this.workspaceDir, relativePath);
        try {
            const data = await fs.readFile(fullPath, 'utf-8');
            return data;
        } catch (error) {
            if (error.code === 'ENOENT') {
                return '[not found]';
            }
            return `[error: ${error.message}]`;
        }
    }

    /**
     * Write content to a file in the workspace directory.
     * @param {string} relativePath - The relative path to the file.
     * @param {string} content - The content to write to the file.
     * @returns {Promise<boolean|string>} - True if the file was written successfully, or an error message.
     */
    async writeFile(relativePath, content) {
        const fullPath = path.join(this.workspaceDir, relativePath);
        try {
            await fs.writeFile(fullPath, content, 'utf-8');
            return "success";
        } catch (error) {
            return `[error: ${error.message}]`;
        }
    }

    /**
     * Run a shell command in a specified directory within the workspace.
     * @param {string} relativeDir - The relative directory to run the command in.
     * @param {string} command - The shell command to execute.
     * @returns {Promise<string>} - The output of the command, or an error message if it fails.
     */
    runShellCommand(relativeDir, command) {
        const fullDir = path.join(this.workspaceDir, relativeDir);
        return new Promise((resolve) => {
            exec(command, { cwd: fullDir }, (error, stdout, stderr) => {
                if (error) {
                    resolve(`[error: ${stderr || error.message}]`);
                } else {
                    resolve(stdout);
                }
            });
        });
    }
}

export default WorkspaceOp;
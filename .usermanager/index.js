import { Command } from 'commander';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import bcrypt from 'bcryptjs';

const program = new Command();

// Default path matching Nuxt config logic
const DEFAULT_USERS_PATH = path.join(os.homedir(), '.clyo', 'users.json');

program
  .name('clyo-user-manager')
  .description('CLI to manage ClyoCloud users')
  .version('1.0.0');

program
  .command('add')
  .description('Add a new user to the system')
  .argument('<username>', 'Username for the new account')
  .argument('<password>', 'Password for the new account')
  .option('-p, --path <path>', 'Custom path to users.json', DEFAULT_USERS_PATH)
  .action(async (username, password, options) => {
    try {
      const usersFilePath = options.path;
      
      // Ensure directory exists
      await fs.mkdir(path.dirname(usersFilePath), { recursive: true });

      let users = [];
      try {
        const data = await fs.readFile(usersFilePath, 'utf-8');
        users = JSON.parse(data);
      } catch (err) {
        if (err.code !== 'ENOENT') throw err;
        console.log('Creating new users file...');
      }

      // Check if user exists
      if (users.find(u => u.name === username)) {
        console.error(`Error: User "${username}" already exists.`);
        process.exit(1);
      }

      // Hash password
      console.log('Hashing password...');
      const hashedPassword = await bcrypt.hash(password, 12);

      // Add user
      users.push({
        name: username,
        password: hashedPassword,
        downloadPath: '' // Default empty download path
      });

      // Save file
      await fs.writeFile(usersFilePath, JSON.stringify(users, null, 2), 'utf-8');
      console.log(`Successfully added user: ${username}`);
      
    } catch (error) {
      console.error('An error occurred:', error.message);
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List all registered users')
  .option('-p, --path <path>', 'Custom path to users.json', DEFAULT_USERS_PATH)
  .action(async (options) => {
    try {
      const data = await fs.readFile(options.path, 'utf-8');
      const users = JSON.parse(data);
      console.log('\nRegistered Users:');
      console.log('-----------------');
      users.forEach(u => console.log(`- ${u.name}`));
      console.log('');
    } catch (err) {
      console.error('Error reading users:', err.message);
    }
  });

program.parse();

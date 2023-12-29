import { create } from 'ipfs-http-client';
import express from 'express';
import fs from 'fs';
import events from 'events';
import Web3 from 'web3';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import mysql from 'mysql2/promise';
import multer from 'multer';
import ejs from 'ejs';
import bodyParser from 'body-parser';

// Get the current module's file path
const __filename = fileURLToPath(import.meta.url);
// Get the current module's directory path
const __dirname = dirname(__filename);

// Create an IPFS HTTP client
const ipfs = create({ host: 'localhost', port: '5002', protocol: 'http' });

// Create a Web3 instance
const web3 = new Web3('http://127.0.0.1:7545');

// Create an event emitter
const eventEmitter = new events.EventEmitter();

// Set the maximum number of listeners for the event emitter
eventEmitter.setMaxListeners(1000);

// Create an Express application
const app = express();

// Set the view engine to EJS
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views'); // Set the views directory

// MySQL database configuration
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'root123',
  database: 'loginsignup',
  connectionLimit: 10,
};

// Create a connection pool to the MySQL database
const pool = mysql.createPool(dbConfig);

// Function to execute a MySQL query and return a Promise
const executeQuery = (query, values) => {
  return new Promise((resolve, reject) => {
    pool.getConnection().then(async (conn) => {
      const res = await conn.query(query, values);
      conn.release();
      resolve(res[0][0]);
    });
  });
};

// Function to add a file to IPFS and store its hash on the Ethereum blockchain
const addFile = async (fileName, filePath) => {
  const file = fs.readFileSync(filePath);
  const fileAdded = await ipfs.add({ path: fileName, content: file });
  const fileHash = fileAdded.cid.toString();

  const accounts = await web3.eth.getAccounts();
  const fromAccount = accounts[0];

  const contractAddress = '0x2b4a9E10F80F5664667DbAa0a8E157F2E2De309D';
  const contractAbi = [
    {
      inputs: [
        {
          internalType: 'string',
          name: 'hash',
          type: 'string',
        },
      ],
      name: 'sendHash',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function',
    },
    {
      inputs: [],
      name: 'getHash',
      outputs: [
        {
          internalType: 'string',
          name: '',
          type: 'string',
        },
      ],
      stateMutability: 'view',
      type: 'function',
    },
  ];

  const contractInstance = new web3.eth.Contract(contractAbi, contractAddress);
  const transactionReceipt = await contractInstance.methods.sendHash(fileHash).send({ from: fromAccount });

  return {
    fileHash,
    contractAddress,
    transactionReceipt,
    fromAccount,
  };
};

// Function to create the students table in the database
const createStudentsTable = async () => {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS students (
      rollNumber INT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(255),
      hashAddress TEXT,
      Certificate TEXT,
      Remark TEXT
    )
  `;
  await executeQuery(createTableQuery);
};

// Function to create the staff table in the database
const createStaffTable = async () => {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS staff (
      id INT PRIMARY KEY AUTO_INCREMENT,
      username VARCHAR(255) NOT NULL,
      pass1 VARCHAR(255) NOT NULL
    )
  `;

  await executeQuery(createTableQuery);
};

// Function to create the admin table in the database
const createAdminTable = async () => {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS admin (
      id INT PRIMARY KEY AUTO_INCREMENT,
      username VARCHAR(255) NOT NULL,
      pass1 VARCHAR(255) NOT NULL
    )
  `;

  await executeQuery(createTableQuery);
};

// Function to create the students registration table in the database
const createStudentsRegistrationTable = async () => {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS students_registration (
      rollNumber INT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(255),
      hashAddress TEXT
    )
  `;

  await executeQuery(createTableQuery);
};

// Function to create all required tables in the database
const createTables = async () => {
  await createStudentsTable();
  await createStaffTable();
  await createAdminTable();
  await createStudentsRegistrationTable();
};

// Create the required tables
createTables().catch((err) => {
  console.error('Error creating tables:', err);
});

// Multer middleware for handling file uploads
const upload = multer({ dest: __dirname + '/uploads/' });

// Middleware for parsing form data
app.use(bodyParser.urlencoded({ extended: false }));

// Route for the main page
app.get('/', (req, res) => {
  res.render('main');
});

// Route for user login
app.get('/login', (req, res) => {
  res.render('login');
});

// Route for handling user login form submission
app.post('/login', async (req, res) => {
  const username = req.body.username;
  const password = req.body.password;
    // ...

    const role = req.body.role;

    console.log(username, password, role);
  
    let table;
    switch (role) {
      case 'staff':
        table = 'staff';
        break;
      case 'students_registration':
        table = 'students_registration';
        break;
      case 'admin':
        table = 'admin';
        break;
      default:
        return res.status(400).send('Invalid role');
    }
  
    // Use parameterized queries to prevent SQL injection
    const query = `SELECT * FROM ${table} WHERE username=? AND pass1=?`;
    const values = [username, password];
    const exQueryRes = await executeQuery(query, values);
  
    if (exQueryRes) {
      if (role === 'staff') {
        // Staff login
        res.redirect('/staff');
      } else if (role === 'students_registration') {
        // Students registration login
        res.redirect('/home');
      } else if (role === 'admin') {
        // Admin login
        res.redirect('/admin');
      }
    } else {
      console.log('Failed to login');
      res.render('login', { error: 'Failed to login' });
    }
  });
  
  // Route for user registration
  app.get('/register', (req, res) => {
    res.render('register');
  });
  
  // Route for handling user registration form submission
  app.post('/register', async (req, res) => {
    const username = req.body.username;
    const password = req.body.password;
    const role = req.body.role; // New field for role selection in the form
  
    console.log(username, password, role);
  
    let table;
    switch (role) {
      case 'staff':
        table = 'staff';
        break;
      case 'students_registration':
        table = 'students_registration';
        break;
      case 'admin':
        table = 'admin';
        break;
      default:
        return res.status(400).send('Invalid role');
    }
  
    // Use parameterized queries to prevent SQL injection
    const query = `INSERT INTO ${table} (username, pass1) VALUES (?, ?)`;
    const values = [username, password];
    await executeQuery(query, values);
  
    res.redirect('/');
  });
  
  // Route for the home page
  app.get('/home', (req, res) => {
    res.render('home');
  });
  
  // Route for staff page
  app.get('/staff', (req, res) => {
    res.render('staff');
  });
  
  // Route for admin page
  app.get('/admin', (req, res) => {
    res.render('admin');
  });
   
  // Route for handling staff file upload and storing the hash and remark in the database
  app.post('/staff/upload', upload.single('file'), async (req, res) => {
    try {
      const file = req.file;
      const fileName = file.originalname;
      const filePath = file.path;
  
      const { fileHash, contractAddress, transactionReceipt, fromAccount } = await addFile(fileName, filePath);
      fs.unlink(filePath, (err) => {
        if (err) console.log(err);
      });
  
      const remark = req.body.remark; // Assuming you have a textarea field with name="remark" in your staff-upload.ejs file
  
      // Store the hash and remark in the database
      const updateQuery = `INSERT INTO students (Certificate, Remark) VALUES (?, ?)`;
      const values = [`name:${fileName}:${fileHash}`, remark];
      await executeQuery(updateQuery, values);
  
      res.render('staff-upload', {
        fileName,
        fileHash,
        ownerAddress: fromAccount,
        contractAddress,
        transactionAddress: transactionReceipt.transactionHash,
        remarks: [], // Pass an empty array for now, as you haven't implemented the remarks functionality yet
      });
    } catch (error) {
      console.log('Error... Failed to upload the file to IPFS');
      console.error(error);
      res.status(500).send('Failed to upload the file to IPFS');
    }
  });
    
  // Route for handling admin file upload and storing the hash in the database
  app.post('/admin/upload', upload.single('file'), async (req, res) => {
    try {
      const file = req.file;
      const fileName = file.originalname;
      const filePath = file.path;
  
      const { fileHash, contractAddress, transactionReceipt, fromAccount } = await addFile(fileName, filePath);
      fs.unlink(filePath, (err) => {
        if (err) console.log(err);
      });
  
      const remark = req.body.remark; // Assuming you have a textarea field with name="remark" in your staff-upload.ejs file
  
      // Store the hash in the database
      const updateQuery = `INSERT INTO students (hashAddress) VALUES (?)`;
      const values = [`name:${fileName}:${fileHash}`];
      await executeQuery(updateQuery, values);

  
      res.render('admin-upload', {
        fileName,
        fileHash,
        ownerAddress: fromAccount,
        contractAddress,
        transactionAddress: transactionReceipt.transactionHash,
        remarks: [], // Pass an empty array for now, as you haven't implemented the remarks functionality yet
      });
    } catch (error) {
      console.log('Error... Failed to upload the file to IPFS');
      console.error(error);
      res.status(500).send('Failed to upload the file to IPFS');
    }
  });
// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something went wrong!');
});

// Set the server port
const PORT = 8080;

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});  

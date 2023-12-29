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
      Marksheet TEXT,
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
      Marksheet TEXT
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
  await insertInitialRollNumbers();
};


const insertInitialRollNumbers = async () => {
  try {
    // Roll numbers to be inserted
    const rollNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    for (const rollNumber of rollNumbers) {
      // Check if the roll number already exists in the database
      const checkQuery = `SELECT COUNT(*) AS count FROM students WHERE rollNumber = ?`;
      const rowCount = await executeQuery(checkQuery, [rollNumber]);

      if (rowCount && rowCount.count === 0) {
        // If the roll number doesn't exist, then insert it
        const insertQuery = `INSERT INTO students (rollNumber) VALUES (?)`;
        await executeQuery(insertQuery, [rollNumber]);
        console.log(`Roll number ${rollNumber} inserted.`);
      } else {
        console.log(`Roll number ${rollNumber} already exists. Skipping...`);
      }
    }
  } catch (error) {
    console.error('Error inserting initial roll numbers:', error);
  }
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
  
  
 // ...

// Route for handling staff file upload and storing the hash and remark in the database
app.post('/staff/upload', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    const fileName = file.originalname;
    const filePath = file.path;

    // Add the file to IPFS and get the file hash and other details
    const { fileHash, contractAddress, transactionReceipt, fromAccount } = await addFile(fileName, filePath);

    // Remove the uploaded file from the server's local storage
    fs.unlink(filePath, (err) => {
      if (err) console.log(err);
    });

    const rollNumber = req.body.rollNumber; // Retrieve the roll number selected in the form
    const remark = req.body.remark; // Retrieve the remark from the textarea in the form

    // Check if the row already exists in the 'students' table
    const existingDataQuery = `SELECT Certificate, Remark FROM students WHERE rollNumber=?`;
    const existingDataValues = [rollNumber];
    const existingDataResult = await executeQuery(existingDataQuery, existingDataValues);

    if (existingDataResult) {
      const existingRemark = existingDataResult.Remark;
      const existingCertificate = existingDataResult.Certificate;

      // If both remark and certificate are already present and the remark is the same
      if (existingRemark && existingCertificate && existingRemark === remark) {
        return res.render('staff-upload', {
          displayMsg: 'Data already inserted for the roll number',
          fileName,
          fileHash,
          ownerAddress: fromAccount,
          contractAddress,
          transactionAddress: transactionReceipt.transactionHash,
        });
      }

      // If the certificate is already present and the remark is different, update the remark
      if (existingCertificate && existingRemark !== remark) {
        const updateRemarkQuery = `UPDATE students SET Remark=? WHERE rollNumber=?`;
        const updateRemarkValues = [remark, rollNumber];
        await executeQuery(updateRemarkQuery, updateRemarkValues);
        return res.render('staff-upload', {
          displayMsg: 'Certificate already inserted for the roll number, Remark updated',
          fileName,
          fileHash,
          ownerAddress: fromAccount,
          contractAddress,
          transactionAddress: transactionReceipt.transactionHash,
        });
      }
    }

    // If the roll number exists and Certificate column is empty, then update the Certificate and Remark fields
    if (!existingDataResult.Certificate) {
      const updateBothQuery = `UPDATE students SET Certificate=?, Remark=? WHERE rollNumber=?`;
      const updateBothValues = [`${fileHash}`, remark, rollNumber];
      await executeQuery(updateBothQuery, updateBothValues);
      return res.render('staff-upload', {
        displayMsg: 'Certificate uploaded for the roll number, Remark updated',
        fileName,
        fileHash,
        ownerAddress: fromAccount,
        contractAddress,
        transactionAddress: transactionReceipt.transactionHash,
      });
    }

    // If none of the above conditions matched, update both the certificate and the remark
    const updateCertificateQuery = `UPDATE students SET Certificate=?, Remark=? WHERE rollNumber=?`;
    const updateCertificateValues = [`${fileHash}`, remark, rollNumber];
    await executeQuery(updateCertificateQuery, updateCertificateValues);
    return res.render('staff-upload', {
      displayMsg: 'Certificate uploaded for the roll number, Remark updated',
      fileName,
      fileHash,
      ownerAddress: fromAccount,
      contractAddress,
      transactionAddress: transactionReceipt.transactionHash,
    });
  } catch (error) {
    console.log('Error... Failed to upload the file to IPFS');
    console.error(error);
    res.status(500).send('Failed to upload the file to IPFS');
  }
});


app.post('/admin/upload', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    const fileName = file.originalname;
    const filePath = file.path;

    // Add the file to IPFS and get the file hash and other details
    const { fileHash, contractAddress, transactionReceipt, fromAccount } = await addFile(fileName, filePath);

    // Remove the uploaded file from the server's local storage
    fs.unlink(filePath, (err) => {
      if (err) console.log(err);
    });

    const rollNumber = req.body.rollNumber; // Retrieve the roll number selected in the form

    // Check if the row already exists in the 'students' table
    const existingDataQuery = `SELECT Marksheet FROM students WHERE rollNumber=?`;
    const existingDataValues = [rollNumber];
    const existingDataResult = await executeQuery(existingDataQuery, existingDataValues);

    if (existingDataResult) {
      if (existingDataResult.Marksheet) {
        // If Marksheet column already has data for the roll number, display the message
        res.send('Data already inserted for the roll number');
        return;
      }
    }

    // If the roll number exists and Marksheet column is empty, then update the Marksheet field
    const updateMarksheetQuery = `UPDATE students SET Marksheet=? WHERE rollNumber=?`;
    const updateMarksheetValues = [`${fileHash}`, rollNumber];
    await executeQuery(updateMarksheetQuery, updateMarksheetValues);

    // Optionally, you can add similar logic to update the Certificate and Remark fields if needed.

    res.render('admin-upload', {
      fileName,
      fileHash,
      ownerAddress: fromAccount,
      contractAddress,
      transactionAddress: transactionReceipt.transactionHash,
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
1. jsipfs daemon
2. nodemon --experimental-modules app.js or nodemon app.js
3. workbench to check databse changes
4. webiste the code is running on http://localhost:8080
5. remeber that there is mysql queries executed for create student table, staff table, and admin table
6. staff can upload certificate and remarks and admin can upload marksheets
7. to start daemon in new project  
   i. jsipfs config --json API.HTTPHeaders.Access-Control-Allow-Origin '["http://127.0.0.1:5002", "http://localhost:3000", "http://127.0.0.1:5001", "https://webui.ipfs.io"]'                                                                                                                   
   ii. jsipfs config --json API.HTTPHeaders.Access-Control-Allow-Methods '["PUT", "POST"]'
8. Run npm install to download all the dependencies
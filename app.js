const express = require('express');
const bodyParser = require('body-parser');
const upload = require('express-fileupload');
require('dotenv').config();

const handleRequest = require('./handleRequest.js');


// Initialize app variable 
const app = express();
const PORT = process.env.PORT || 5000;

// Body-parser middleware
// adding a generic JSON and URL-encoded parser as a top-level middleware, which will parse the bodies of all incoming requests.
app.use(bodyParser.urlencoded({ extended: false }));
var jsonParser = bodyParser.json();
app.use(upload());
var allowCrossDomain = function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      
    // intercept OPTIONS method
    if ('OPTIONS' == req.method) {
      res.send(200);
    }
    else {
      next();
    }
};
app.use(allowCrossDomain);

app.get('/' , function(req,res){
    res.send('Hello World for testing !');
});

// Booking 
app.post('/v1/appointment' , jsonParser, handleRequest.getAppointmentDetails);

// To get the slots booked on specific operator on particular day
app.post('/v1/openslot' , jsonParser, handleRequest.getOpenSlotStatus);

//  /v1/operator?id=2&date=2021-12-13 or omit date
app.get('/v1/operator' ,  handleRequest.getAllAppointment);

// Customer History 
//  /v1/bookings?id=2&date=2021-12-13
app.get('/v1/bookings' ,  handleRequest.getAllBookings);

//cancel the appointment
app.delete('/v1/cancel' , handleRequest.cancelAppointment);

// //file upload 
// app.post('/v1/fileupload' , handleRequest.fileUpload )

// get all operator 
app.get('/v1/operators' ,handleRequest.getAllOperator );

app.listen(PORT , () => {
    console.log(`Server Started on port ${PORT}`);
})


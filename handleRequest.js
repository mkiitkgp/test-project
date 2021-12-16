const Pool = require('pg').Pool;
const fs = require('fs');
const AWS = require('aws-sdk');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DATABASE_USER,
    host : process.env.DATABASE_HOST,
    database : process.env.DATABASE_NAME,
    password : process.env.DATABASE_PASSWORD,
    port : process.env.DATABASE_PORT
})

const ID = process.env.AWS_KEY_ID;
const SECRET = process.env.AWS_SECRET_KEY;

// The name of the bucket that you have created
const BUCKET_NAME = process.env.AWS_BUCKET_NAME;

const s3 = new AWS.S3({
    accessKeyId: ID,
    secretAccessKey: SECRET
});

const uploadFile = async (bufferData , fileName , mimetype) => {
    

    // Setting up S3 upload parameters
    const params = {
        Bucket: BUCKET_NAME,
        Key: fileName,
        Body: bufferData,
        ContentType: mimetype
    };

    // Uploading files to the bucket
    console.log('entering upload files');
    let uploadResult = await s3.upload(params).promise();
    console.log(`File uploaded successfully at ${uploadResult.Location}`);
    return uploadResult.Location;
    //console.log(`File uploaded successfully. ${data.Location}`);
};

const openSlotAppointment =  async ( obj ) => {
    console.log('Open slot');

    const {operator_id , date } = obj;
    let start_time = `${date} ${obj.start_time}:00`;
    let end_time = `${date} ${obj.end_time}:00`;

    //console.log(operator_id , date , start_time , end_time);
    const { rows } = await pool.query('SELECT * FROM appointment WHERE operator_id = $1 AND date_of_booking = $2 AND start_time = $3 AND end_time = $4' , [operator_id , date , start_time , end_time]);
    console.log(rows);
    if(rows.length > 0){
        return false;
    }
    else{
        return true;
    }
}

// Post request 
// @param : customer_id , operator_id , start_time , end_time , date , mp3 file
const getAppointmentDetails =  function(req , res) {
    console.log('Entering here');
    console.log(req.body);

    openSlotAppointment(req.body).then(r =>{
        if(r){
            const {operator_id , date , customer_id } = req.body;
            let start_time = `${date} ${req.body.start_time}:00`;
            let end_time = `${date} ${req.body.end_time}:00`;
            let status = true;
            let audioUrl ="";
            if(req.files){
                let resultFile = req.files.file;
                let fileData = resultFile.data;
                let fileName = `${customer_id}_${operator_id}_${date}_${start_time}_${end_time}_${resultFile.name}`;
                let mimeType = resultFile.mimetype;

                uploadFile(fileData , fileName , mimeType ).then(r =>{
                    console.log('Entering upload files insed database');
                    audioUrl = r;
                    pool.query(`INSERT INTO appointment (operator_id , customer_id , date_of_booking , start_time , end_time , status, audio_file ) 
                        VALUES ($1, $2, $3 ,$4 ,$5 , $6 , $7) RETURNING appointment_id` ,[operator_id ,customer_id,date,start_time,end_time,status,audioUrl], function(err , result){
                            if(err){
                                 throw err;
                            }
                    console.log(result.rows[0].appointment_id);
                    res.status(200).json({"message" : `Slot Booked With id : ${result.rows[0].appointment_id}`});
                    })
                })
            }
            else{
                 pool.query(`INSERT INTO appointment (operator_id , customer_id , date_of_booking , start_time , end_time , status ) 
                        VALUES ($1, $2, $3 ,$4 ,$5 , $6 , $7) RETURNING appointment_id` ,[operator_id ,customer_id,date,start_time,end_time,status,audioUrl], function(err , result){
                            if(err){
                                 throw err;
                            }
                    console.log(result.rows[0].appointment_id);
                    res.status(200).json({"message" : `Slot Booked With id : ${result.rows[0].appointment_id}`});
                })
            }
        }
        else{
            res.status(400).json({"message" : 'Slot Already Booked ! Try again with new slot'});
        }
    });


}

const parseTimeFunction = (obj) =>{
        let hour = (obj.getHours() < 10 ?'0':'') + `${obj.getHours()}`
        let minute =  (obj.getMinutes()<10?'0':'') + `${obj.getMinutes()}`;
        return `${hour}:${minute}`; 
}

const parseDateFunction = (d) =>{
    let mm = d.getMonth() + 1;
    let dd = d.getDate();
    let yy = d.getFullYear();
    let myDateString = yy + '-' + mm + '-' + dd; 
    return myDateString;
}

//get all operators
const getAllOperator = function(req , res){
    pool.query('SELECT * FROM operator' , function(err , result){
        if(err){
            throw err;
        }
        
        res.status(200).json(result.rows);
        
        console.log(result.rows);
    });
}

// POST get open slot 
const getOpenSlotStatus =  function(req , res) {
    console.log('Entering Slot details ');
    console.log(req.body);
    
    const { operator_id , date } = req.body;

    let outputObject = {'operator_id' : operator_id , 'date': date };

    pool.query('SELECT * FROM appointment WHERE operator_id = $1 AND date_of_booking = $2' , [operator_id , date], function(err , result){
        if(err){
            throw err;
        }
       console.log(result.rows);
       let bookedSlots = [];
       if(result.rows.length > 0){
            
            let createObj = result.rows.map( row => {
                let obj = { 'start_time' : parseTimeFunction(new Date(row.start_time)),
                                'end_time' : parseTimeFunction(new Date(row.end_time))
                            };
                    bookedSlots.push(obj);       
            })
            
            outputObject['operator_id'] = result.rows[0].operator_id;
            outputObject['date'] = parseDateFunction(new Date(result.rows[0].date_of_booking));
            outputObject['booked_slot'] = bookedSlots;
            console.log(outputObject);
       }
       else{
            outputObject['booked_slot'] = bookedSlots;
       }    
       res.status(200).json(outputObject);

    })



    

    //console.log(date);
}


const getAllAppointment = function(req , res){
    let operator_id = req.query.id;
    let date = req.query.date || "";

    
    //console.log(id , date);
    if( date !== ""){
        pool.query(`SELECT appointment_id , appointment.date_of_booking , appointment.start_time , 
        appointment.end_time ,customer.name AS customer_name , customer.email AS customer_email ,  
        operator.operator_id , operator.name AS operator_name , operator.location AS operator_location , appointment.audio_file 
        FROM appointment
        LEFT JOIN customer ON appointment.customer_id = customer.customer_id
        LEFT JOIN operator ON appointment.operator_id = operator.operator_id
        WHERE appointment.operator_id = $1 AND appointment.date_of_booking = $2` , [operator_id , date], function(err , result){
            if(err){
                throw err;
            }
            console.log(result.rows);
            res.status(200).json(result.rows);
        }); 
    }
    else{
        pool.query(`SELECT appointment_id , appointment.date_of_booking , appointment.start_time , 
        appointment.end_time ,customer.name AS customer_name , customer.email AS customer_email ,  
        operator.operator_id , operator.name AS operator_name , operator.location AS operator_location , appointment.audio_file 
        FROM appointment
        LEFT JOIN customer ON appointment.customer_id = customer.customer_id
        LEFT JOIN operator ON appointment.operator_id = operator.operator_id
        WHERE appointment.operator_id = $1` , [operator_id], function(err , result){
            if(err){
                throw err;
            }
            console.log(result.rows);
            res.status(200).json(result.rows);
        });
    }  
}


const getAllBookings = function(req, res){
    let customer_id = req.query.id;
    let date = req.query.date || "";

    if( date !== ""){
        pool.query(`SELECT appointment_id , appointment.date_of_booking , appointment.start_time , 
        appointment.end_time ,  
        operator.operator_id , operator.name AS operator_name , operator.location AS operator_location , appointment.audio_file 
        FROM appointment
        LEFT JOIN customer ON appointment.customer_id = customer.customer_id
        LEFT JOIN operator ON appointment.operator_id = operator.operator_id
        WHERE appointment.customer_id = $1 AND appointment.date_of_booking = $2` , [customer_id , date], function(err , result){
            if(err){
                throw err;
            }
            console.log(result.rows);
            res.status(200).json(result.rows);
        }); 
    }
    else{
        pool.query(`SELECT appointment_id , appointment.date_of_booking , appointment.start_time , 
        appointment.end_time  ,  
        operator.operator_id , operator.name AS operator_name , operator.location AS operator_location , appointment.audio_file 
        FROM appointment
        LEFT JOIN customer ON appointment.customer_id = customer.customer_id
        LEFT JOIN operator ON appointment.operator_id = operator.operator_id
        WHERE appointment.customer_id = $1` , [customer_id], function(err , result){
            if(err){
                throw err;
            }
            console.log(result.rows);
            res.status(200).json(result.rows);
        });
    }  

}

// Post request for cancel appointment
// @param : appointment_id

const cancelAppointment =  function(req , res) {
    console.log('cancel appointment here');
    console.log(req.query.appointment_id);
    const { appointment_id } = req.query;
    if(appointment_id !== null){
        pool.query('DELETE FROM appointment WHERE appointment_id = $1;' , [appointment_id], function(err , result){
            if(err){
                throw err;
            }
            if(result.rows.length === 0){
                res.status(200).json({"message" : `Successfully Deleted  Appointment number : ${appointment_id}`});
            }
            console.log(result.rows);
        });
    }

}

const fileUpload = function(req , res){
    console.log(req.files);
    let resultFile = req.files.file;
    let fileData = resultFile.data;
    let fileName = resultFile.name;
    let mimeType = resultFile.mimetype;
    console.log(fileData , fileName , mimeType);
    //uploadFile(fileData , fileName , mimeType);
    // fs.readFile('./cat-480.jpg', function (err, data) {
    //     console.log(data);
    // });

}





module.exports ={ 
    getAppointmentDetails , 
    cancelAppointment , 
    getOpenSlotStatus ,
    getAllAppointment ,
    getAllBookings,
    fileUpload,
    cancelAppointment,
    getAllOperator } 
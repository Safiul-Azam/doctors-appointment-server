const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');
const jwt = require('jsonwebtoken');
const app = express()
const port = process.env.PORT || 5000

// middle ware
app.use(cors())
app.use(express.json())


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.gkhfl.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


const verifyJwt = (req, res, next)=>{
    const authHeader = req.headers.authorization 
    if(!authHeader){
        return res.status(401).send({message: 'Unauthorized access'})
    }
    const token = authHeader.split(' ')[1]
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET,(err, decoded)=>{
        if(err){
            return res.status(403).send({message:'forbidden access'})
        }
        req.decoded = decoded
        next()
    })
}

async function run() {
    try {
        await client.connect()
        const serviceCollection = client.db('doctor-appointment').collection('appointmentSchedule')
        const bookingCollection = client.db('doctor-appointment').collection('booking')
        const userCollection = client.db('doctor-appointment').collection('user')

        app.get('/services', async (req, res) => {
            const query = {}
            const cursor = serviceCollection.find(query)
            const result = await cursor.toArray()
            res.send(result)
        })
        
        // Warning: This is not the proper way to query multiple collection. 
        // After learning more about mongodb. use aggregate, lookup, pipeline, match, group
        app.get('/available', async (req, res) => {
            const date = req.query.date || 'May 15, 2022'
            // step 1 get all services
            const services = await serviceCollection.find().toArray()
            //step 2 find all booking by  that date
            const query = { date: date }
            const booking = await bookingCollection.find(query).toArray()

            //step  loop for all service
            services.forEach(service => {
                // step 4: find bookings for that service. output: [{}, {}, {}, {}]
                const bookingService = booking.filter(book => book.treatment === service.name)
                // step 5: select slots for the service Bookings: ['', '', '', ''] 
                const booked = bookingService.map(book => book.slot)
                // step 6: select those slots that are not in bookedSlots
                const available = service.slots.filter(slot => !booked.includes(slot))
                //step 7: set available to slots to make it easier 
                service.slots = available
            })
            res.send(services)

        })

        app.get('/booking', verifyJwt, async (req, res)=>{
            const patientEmail = req.query.patientEmail
            const query = {patientEmail:patientEmail}
            const booking = await bookingCollection.find(query).toArray()
            res.send(booking)
        })
        app.post('/booking', async (req, res) => {
            const booking = req.body
            const query = { treatment: booking.treatment, date: booking.date, patientEmail: booking.patientEmail }
            const exists = await bookingCollection.findOne(query)
            if (exists) {
                return res.send({ success: false, booking: exists })
            }
            const result = await bookingCollection.insertOne(booking)
            res.send({ success: true, booking: result })
        })
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
              $set: user,
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send({ result, token });
          })
        // app.put('/user/:email',async(req, res)=>{
        //     const email = req.params.email 
        //     const filter = {email:email}
        //     const user = req.body
        //     const options = { upsert: true };
        //     const updateDoc={
        //         $set:user,
        //     }
        //     const result = await userCollection.updateOne(filter, updateDoc,options)
        //     const token = jwt.sign({email:email},process.env.ACCESS_TOKEN_SECRET,{
        //         expiresIn:'1h'
        //     })
        //     res.send({result,token})
        // })
    } finally {

    }
}
run().catch(console.dir);
app.get('/', (req, res) => {
    res.send('doctors appointment server running')
})
app.listen(port, () => {
    console.log('listing', port)
})
// Import necessary modules
const express = require('express');
const { Client } = require('@line/bot-sdk');
const axios = require('axios');
require('dotenv').config();
const bodyParser = require('body-parser');
const cors = require('cors');

// Create an Express application
const app = express();

// LINE bot configuration from environment variables
const lineConfig = {
    channelAccessToken: "xs429d+oT5LcQZnEDzO4xIKNvpYqOXDycud70+/YGy+YZkqccxK1YcuayacYgSOcWr+GE92LndQMQPnpfDIZJC43nBnSh3inv0QZYTrQvFrIYp19Hfbd0RCKLSJDEC4oXndefBx0o/Y0bMTZrOgvHwdB04t89/1O/w1cDnyilFU",
    channelSecret: "a0f2c073d350b4e92d96664eee5fd2cd",
};

// Initialize the LINE client
const client = new Client(lineConfig);

// Middleware to parse incoming JSON data
app.use(cors({
    origin: 'http://mymymyiridium.s3-website-ap-southeast-2.amazonaws.com', // Allow this specific origin
    methods: ['GET', 'POST'],       // Allow specific methods
    allowedHeaders: ['Content-Type'] // Allow specific headers
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

let Webpush = []; // Array to store messages from both sources

// Unified webhook to handle both LINE and RockBLOCK messages
app.post('/webhook', (req, res) => {
    // Determine if the request is from LINE or RockBLOCK
    if (req.body.events) {
        // Handle LINE webhook events
        const events = req.body.events;
        if (events.length > 0) {
            const event = events[0];
            const message = event.message.text;

            sendToRockBlockMT(message)
                .then(() => {
                    console.log('Message sent to RockBLOCK successfully');

                    const lineMessage = {
                        user: "Line User",
                        text: message,
                        timestamp: new Date().toISOString(),
                        source: "LINE",
                    };
                    console.log(lineMessage);
                    Webpush.push(lineMessage);

                    res.status(200).send('Message forwarded to RockBLOCK');
                })
                .catch((error) => {
                    console.error('Error forwarding message to RockBLOCK:', error.message);
                    res.status(500).send('Error forwarding message to RockBLOCK');
                });
        } else {
            res.status(400).send('No LINE events received');
        }
    } else if (req.body.imei && req.body.data) {
        // Handle RockBLOCK MO messages
        const { imei, momsn, transmit_time, data } = req.body;

        const [date, time] = transmit_time.split(' ');

        // Decode the message data from hex
        const decodedMessage = Buffer.from(data, 'hex').toString('utf-8');

        if (decodedMessage.startsWith("[L>R]")) {
            console.log("Message from LINE received back from RockBLOCK; ignoring.");
            return res.status(200).send("Message ignored.");
        }

        console.log(`Received message from RockBLOCK (IMEI: ${imei}, MOMSN: ${momsn}): ${decodedMessage}`);

        const messageText = `Message from RockBLOCK:
Message: ${decodedMessage}
IMEI: ${imei}
Date: ${date}
Time (UTC): ${time}
Please answer back after receiving this message.`;

        const rockblockMessage = {
            user: "RockBLOCK Device",
            text: decodedMessage,
            imei: imei,
            timestamp: new Date().toISOString(),
            source: "RockBLOCK",
        };
        console.log(rockblockMessage);
        Webpush.push(rockblockMessage);

        // Send the decoded message to a LINE user
        const userId = "Uf6610f51ead2f45519dc9a2b0d8dc64b";
        client
            .pushMessage(userId, {
                type: 'text',
                text: messageText,
            })
            .then(() => {
                console.log('Message forwarded to LINE successfully');
                res.status(200).send('Message forwarded to LINE');
            })
            .catch((error) => {
                console.error('Error forwarding message to LINE:', error.message);
                res.status(500).send('Error forwarding message to LINE');
            });
    } else {
        res.status(400).send('Invalid webhook request');
    }
});

// Endpoint to send a message to the RockBLOCK device
app.post('/send-rockblock', async (req, res) => {
    const { message } = req.body; // The reply message from the webpage form

    if (!message) {
        return res.status(400).send('Message cannot be empty');
    }

    try {
        console.log(`Sending message to RockBLOCK: ${message}`);
        sendToRockBlockMT(message); // Reuse the existing function

        // Create and push the LINE message object
        const WebMessage = {
            user: "Web User", // Indicates the message source is the webpage user
            text: message,
            timestamp: new Date().toISOString(),
            source: "LINE",
        };
        console.log(WebMessage);
        Webpush.push(WebMessage); // Add to the Webpush array

        console.log('Message sent to RockBLOCK successfully');
        res.status(200).send('Message sent to RockBLOCK successfully');
    } catch (error) {
        console.error('Error sending message to RockBLOCK:', error.message);
        res.status(500).send('Error sending message to RockBLOCK');
    }
});

// Function to send message to RockBLOCK via MT API
function sendToRockBlockMT(message) {
    const tag = "[L>R]"; // Tag for messages from LINE to RockBLOCK
    const rockblockMtUrl = "https://core.rock7.com/rockblock/MT";
    const imei = "00434063245740";
    const username = "iridiumproject.2@gmail.com";
    const password = "rockseven14";

    // Add the tag to the message
    const taggedMessage = `${tag}${message}`;
    console.log(taggedMessage);

    return axios.post(rockblockMtUrl, null, {
        params: {
            imei: imei,
            username: username,
            password: password,
            data: Buffer.from(taggedMessage).toString('hex'),
        },
    });
}

// Default route to check if the server is running
app.get('/', (req, res) => {
    res.send('Unified webhook server is running');
});

// Endpoint to get messages from both LINE and RockBLOCK
app.get('/Webpush', (req, res) => {
    res.json(Webpush); // Send messages in JSON format
});

// Start the server
const PORT = 8080;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

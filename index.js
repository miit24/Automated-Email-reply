const { google } = require('googleapis');
const api = require("./api.json")
const { setInterval, clearInterval } = require('timers');


const oAuth2Client = new google.auth.OAuth2(api.client_id, api.client_secret,api.redirect);

// Set up the OAuth2 client with the credentials
oAuth2Client.setCredentials({
    access_token: api.access_token,
    refresh_token: api.request_token,
});

// Create a new Gmail instance
const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

// Constants for email processing
const userEmail = 'testapp062023@gmail.com';
const labelName = 'listed_inc';

let ThreadID_Present = new Map();

// Function to check for new emails
async function checkNewEmails() {
    try {
        // Get the list of unread messages in the user's inbox
        const { data } = await gmail.users.messages.list({
            userId: 'me',
            q: `is:unread to:${userEmail}`,
        });

        const messages = data.messages;
        if (messages && messages.length > 0) {
            // Iterate over the unread messages
            for (const message of messages) {
                // Check if the email thread has prior replies
                const threadId = message.threadId;
                const id = message.id

                //checking in map if thread_ID is already present or not
                if (ThreadID_Present.get(threadId)) {
                    continue;
                }

                ThreadID_Present.set(threadId, true);
                const threadResponse = await gmail.users.threads.get({
                    userId: 'me',
                    id: threadId,
                });
                const thread = threadResponse.data;

                if (thread.messages.length === 1) {
                    await sendReplyAndLabel(threadId);
                }
            }
        }
    } catch (error) {
        console.error('Error checking for new emails:', error);
    }
}

// Function to send a reply and label the email
async function sendReplyAndLabel(threadId) {
    try {
        // Send the reply
        const replyMessage = 'Automated Repy!!';
        const reply = {
            raw: Buffer.from(
                `To: ${userEmail}\r\n` +
                `Subject: Re: New email\r\n` +
                `In-Reply-To: ${threadId}\r\n` +
                `\r\n` +
                replyMessage
            ).toString('base64'),
            threadId: threadId
        };
        await gmail.users.messages.send({
            userId: 'me',
            resource: reply,
        });

        // Create the label if it doesn't exist
        const labelsResponse = await gmail.users.labels.list({
            userId: 'me',
        });
        const labels = labelsResponse.data.labels;
        let labelId = labels.find((label) => label.name === labelName)?.id;
        if (!labelId) {
            const createLabelResponse = await gmail.users.labels.create({
                userId: 'me',
                resource: {
                    name: labelName,
                    labelListVisibility: 'labelShow',
                    messageListVisibility: 'show',
                },
            });
            labelId = createLabelResponse.data.id;
        }

        // Add the label to the email thread
        await gmail.users.threads.modify({
            userId: 'me',
            id: threadId,
            resource: {
                addLabelIds: [labelId],
            },
        });

        console.log('Reply sent and email labeled:', threadId);
    } catch (error) {
        console.error('Error sending reply and labeling email:', error);
    }
}

// Function to run the email processing sequence at random intervals
function runEmailProcessing() {
    const minInterval = 45 * 1000; // 45 seconds
    const maxInterval = 120 * 1000; // 120 seconds

    const interval = Math.floor(Math.random() * (maxInterval - minInterval + 1)) + minInterval;
    console.log(`Next email time taken ${interval / 1000} seconds`);

    // Clear the interval and restart after processing
    clearInterval(timer);
    timer = setInterval(() => {
        checkNewEmails();
        runEmailProcessing();
    }, interval);
}

// Start the initial email processing
let timer = setInterval(() => {
    checkNewEmails();
    runEmailProcessing();
}, 0);

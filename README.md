# RizzMail

> **A full-stack phone-number-centric communication platform that brings
> together OTP authentication, email-style messaging, real-time inbox
> updates, and email infrastructure in one application.**

RizzMail is a full-stack communication application built as a solo
project. The core idea is simple: use a user's **phone number as their
identity** while providing an email-like communication experience
through a modern web interface.

The application combines a React/Vite frontend with a Node.js/Express
backend, MongoDB persistence, Socket.IO real-time communication, OTP/SMS
integration, and custom SMTP/IMAP email infrastructure.

## Live Application

  Component         Deployment
  ----------------- -----------------------------------------
  **Frontend**      `https://rizzmail.me`
  **Backend API**   `https://rizzmail-backend.onrender.com`
  **Database**      MongoDB
  **Source Code**   GitHub --- `sushmitnitt/rizzmail`

> Deployment URLs can change depending on hosting configuration.

------------------------------------------------------------------------

# What RizzMail Does

RizzMail is designed around the idea of connecting **phone identity +
email-style communication**.

### Core capabilities

-   Phone-number-based authentication
-   OTP generation and verification
-   User profile management
-   Profile photo support
-   Account deletion
-   Phone-number-based recipient identification
-   Email-style conversations and inbox
-   Real-time message updates with Socket.IO
-   MongoDB-backed message persistence
-   Custom SMTP server for inbound email processing
-   IMAP background worker for synchronizing external email
-   Email parsing with `mailparser`
-   Outgoing email support through Nodemailer
-   SMS/OTP integration through MessageCentral
-   Responsive React dashboard
-   Custom domain deployment
-   Separate production frontend and backend services

------------------------------------------------------------------------

# Important Note About IVR

## IVR is **not currently live**

The repository contains IVR-related implementation and the application
architecture is prepared for voice integration, but **the production IVR
feature could not be activated because a suitable telephone number was
not available**.

The original plan was to obtain a toll-free/voice-enabled number for the
application.

The practical blockers were:

1.  The toll-free number provider required a **registered business**
    before providing the number.
2.  **Twilio** was considered as an alternative, but obtaining and
    maintaining the required number/service was too costly for a solo
    developer.
3.  **Telnyx** was also considered, but it required a credit card, which
    was not available for this project.

Because of these resource constraints, IVR was kept as a
**future/ready-to-integrate capability rather than being presented as a
live production feature**.

### The important part

The IVR business logic is already represented in the backend
architecture.

The repository contains:

-   `server/src/controllers/ivrController.js`
-   `server/src/routes/ivr.js`
-   `server/src/routes/ivrRoutes.js`
-   `server/src/services/ivrServer.js`

The existing code demonstrates flows such as:

``` text
Incoming Call
      │
      ▼
Voice Provider
      │
      ▼
IVR Webhook
      │
      ▼
"Press 1 to continue"
      │
      ▼
User Input
      │
      ▼
Find/Create User
      │
      ▼
MongoDB
      │
      ▼
Voice Confirmation
```

There is also code for generating TwiML-style responses and handling
incoming-call workflows.

### Future IVR deployment

Once a suitable voice/toll-free number and provider account are
available, the remaining integration can be connected to the deployed
backend.

The intended workflow is:

``` text
Customer calls RizzMail number
            │
            ▼
Voice provider
            │
            ▼
RizzMail backend webhook
            │
            ▼
IVR controller / voice service
            │
            ▼
MongoDB / application logic
            │
            ▼
Voice response to caller
```

So IVR is best described as **architecturally prepared but not
production-enabled**.

------------------------------------------------------------------------

# Technology Stack

## Frontend

### React 19

The user interface is built with **React 19**.

React is responsible for:

-   Login and OTP screens
-   Dashboard
-   Inbox
-   Conversations
-   Profile management
-   Message interaction
-   Real-time UI updates

### Vite

**Vite** is used as the frontend development server and production build
tool.

It provides:

-   Fast local development
-   Hot module replacement
-   Production bundling
-   Modern frontend build workflow

### Axios

Axios is used as the HTTP client for communication between the frontend
and backend REST API.

### Socket.IO Client

Socket.IO Client provides real-time communication between the browser
and backend.

This allows the inbox to receive updates without requiring a full page
refresh.

### Lucide React

Lucide React is used for interface icons.

------------------------------------------------------------------------

# Backend Stack

## Node.js

Node.js is the runtime powering the backend.

## Express.js

Express provides the REST API layer and handles:

-   Authentication routes
-   Email/message routes
-   Profile operations
-   Account operations
-   API middleware
-   Request handling

## MongoDB

MongoDB is the primary application database.

It stores application data such as:

-   Users
-   OTP records
-   Messages
-   Email records

## Mongoose

Mongoose provides the MongoDB object modeling layer.

The project contains models including:

``` text
User
Otp
Message
Email
```

## Socket.IO

Socket.IO is used for real-time communication.

Users join inbox rooms based on normalized phone numbers, allowing
targeted real-time updates.

Example:

``` text
User Phone Number
       │
       ▼
Normalize phone number
       │
       ▼
Socket.IO room
       │
       ▼
Real-time inbox update
```

## Nodemailer

Nodemailer is used for outgoing email workflows.

## SMTP Server

The project includes a custom SMTP server using the `smtp-server`
package.

Location:

``` text
server/src/smtp/smtpServer.js
```

The SMTP service accepts incoming mail, parses it, stores it in MongoDB,
and can broadcast updates through Socket.IO.

## IMAPFlow

The project includes an IMAP background worker using `imapflow`.

Location:

``` text
server/src/services/imapWorker.js
```

The worker connects to an external mailbox, checks for unseen messages,
parses them, stores them, and broadcasts new email to connected clients.

## Mailparser

`mailparser` is used to parse incoming email content.

It can extract:

-   Sender
-   Recipient
-   Subject
-   Plain-text body
-   HTML body
-   Attachments and related mail metadata

## MessageCentral

MessageCentral is used for OTP/SMS functionality.

The backend can request an authentication token and send OTP
verification messages through the MessageCentral API.

------------------------------------------------------------------------

# Complete Architecture

The high-level production architecture is:

``` text
                         ┌───────────────────────┐
                         │       User Browser    │
                         │     React + Vite      │
                         └───────────┬───────────┘
                                     │
                         HTTPS / REST / WebSocket
                                     │
                  ┌──────────────────┴──────────────────┐
                  │                                     │
                  ▼                                     ▼
        ┌───────────────────┐                ┌───────────────────┐
        │   Express REST    │                │     Socket.IO     │
        │       API         │                │  Real-time layer  │
        └─────────┬─────────┘                └─────────┬─────────┘
                  │                                    │
                  └────────────────┬───────────────────┘
                                   │
                                   ▼
                         ┌───────────────────┐
                         │      MongoDB      │
                         │     Database      │
                         └───────────────────┘
                                   ▲
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
                    ▼                             ▼
             ┌────────────┐                ┌────────────┐
             │ SMTP Server│                │ IMAP Worker│
             └─────┬──────┘                └─────┬──────┘
                   │                             │
                   └──────────────┬──────────────┘
                                  │
                                  ▼
                           Email Infrastructure

                    ┌────────────────────────┐
                    │   MessageCentral SMS    │
                    │      OTP Service        │
                    └────────────────────────┘
```

------------------------------------------------------------------------

# Full Request / Data Workflow

## 1. User Authentication

The user enters their phone number.

``` text
User
  │
  ▼
React Login Page
  │
  ▼
POST /api/auth/send-otp
  │
  ▼
MessageCentral
  │
  ▼
OTP delivered to phone
  │
  ▼
User enters OTP
  │
  ▼
POST /api/auth/verify-otp
  │
  ▼
Backend verifies OTP
  │
  ▼
MongoDB user record
  │
  ▼
Authenticated application
```

Relevant backend route:

``` text
server/src/routes/authRoutes.js
```

------------------------------------------------------------------------

# 2. Loading the Inbox

After authentication, the frontend requests messages for the user's
phone number.

``` http
GET /api/email/messages/:phone
```

The request flows through:

``` text
React
  │
  ▼
Axios
  │
  ▼
Express API
  │
  ▼
MongoDB
  │
  ▼
Messages
  │
  ▼
React Inbox
```

Frontend API wrapper:

``` text
client/src/services/api.js
```

------------------------------------------------------------------------

# 3. Sending a Message

The frontend sends a message using:

``` http
POST /api/email/send
```

Workflow:

``` text
User A
  │
  ▼
React message composer
  │
  ▼
Axios
  │
  ▼
Express
  │
  ▼
Message / Email logic
  │
  ▼
MongoDB
  │
  ▼
Socket.IO
  │
  ▼
User B's inbox
```

This allows the application to behave more like a real-time
communication platform rather than a traditional refresh-based email
client.

------------------------------------------------------------------------

# 4. Real-Time Messaging

Socket.IO is used to maintain real-time inbox synchronization.

When a user connects, the frontend sends their phone number to the
server.

The backend normalizes the number and places the socket into an inbox
room.

Example:

``` text
9876543210
```

The application can also use the corresponding RizzMail-style address:

``` text
9876543210@rizzmail.me
```

This makes targeted inbox updates possible.

------------------------------------------------------------------------

# 5. Incoming Email Through SMTP

RizzMail includes its own SMTP ingestion layer.

Location:

``` text
server/src/smtp/smtpServer.js
```

Workflow:

``` text
External Email Sender
        │
        ▼
RizzMail SMTP Server
        │
        ▼
mailparser
        │
        ▼
Extract sender / recipient / subject / body
        │
        ▼
MongoDB
        │
        ▼
Socket.IO
        │
        ▼
Live Inbox
```

The SMTP server listens on port `2525` in the current implementation.

------------------------------------------------------------------------

# 6. Incoming Email Through IMAP

RizzMail also contains an IMAP synchronization worker.

Location:

``` text
server/src/services/imapWorker.js
```

The worker:

1.  Connects to the configured mailbox.
2.  Checks for unseen messages.
3.  Reads the message source.
4.  Parses the message using `mailparser`.
5.  Extracts the RizzMail recipient alias.
6.  Stores the email in MongoDB.
7.  Emits a real-time Socket.IO event.
8.  Marks the processed email as read.

Current polling interval:

``` text
15 seconds
```

Workflow:

``` text
External Mailbox
       │
       ▼
IMAPFlow
       │
       ▼
Unseen Email
       │
       ▼
Mailparser
       │
       ▼
RizzMail Email Model
       │
       ▼
MongoDB
       │
       ▼
Socket.IO
       │
       ▼
Frontend Inbox
```

------------------------------------------------------------------------

# 7. OTP / SMS Workflow

The backend integrates with MessageCentral for OTP delivery.

``` text
React Login
    │
    ▼
Express API
    │
    ▼
MessageCentral
    │
    ▼
OTP SMS
    │
    ▼
User Phone
    │
    ▼
OTP Verification
    │
    ▼
Authenticated User
```

The service is implemented in:

``` text
server/src/services/smsService.js
```

------------------------------------------------------------------------

# Deployment Architecture

The application is deployed as separate frontend and backend services.

## Frontend Deployment

The React/Vite frontend is deployed and served through the custom
domain:

``` text
https://rizzmail.me
```

The frontend is responsible for:

-   Rendering the UI
-   Calling the backend REST API
-   Maintaining the Socket.IO connection
-   Displaying inbox and conversations
-   Handling authentication screens
-   Managing user profile interactions

The frontend reads the backend address from:

``` env
VITE_BACKEND_URL=https://rizzmail-backend.onrender.com
```

The Axios wrapper automatically appends `/api` when required.

------------------------------------------------------------------------

## Backend Deployment

The Node.js/Express backend is deployed on **Render**:

``` text
https://rizzmail-backend.onrender.com
```

The backend hosts:

-   Express REST API
-   Socket.IO
-   MongoDB connection
-   Authentication logic
-   Messaging logic
-   SMTP integration
-   IMAP worker
-   SMS/OTP integration
-   Other backend services

The production server starts with:

``` bash
npm start
```

which runs:

``` bash
node src/server.js
```

------------------------------------------------------------------------

## Database

MongoDB is used as the persistent database.

The backend connects using:

``` env
MONGO_URI=...
```

Mongoose handles the application models and database operations.

------------------------------------------------------------------------

# End-to-End Production Flow

The complete deployed workflow can be visualized as:

``` text
                         INTERNET
                            │
                            ▼
                    ┌───────────────┐
                    │  rizzmail.me  │
                    │ React + Vite  │
                    └───────┬───────┘
                            │
                 HTTPS REST / WebSocket
                            │
                            ▼
             ┌────────────────────────────┐
             │   Render Backend Service   │
             │ Node.js + Express +        │
             │ Socket.IO                  │
             └────────────┬───────────────┘
                          │
             ┌────────────┼─────────────┐
             │            │             │
             ▼            ▼             ▼
        ┌─────────┐  ┌──────────┐  ┌──────────────┐
        │ MongoDB │  │Message-  │  │ SMTP / IMAP  │
        │         │  │Central   │  │ Email Layer  │
        └─────────┘  └──────────┘  └──────────────┘
             │            │             │
             └────────────┴─────────────┘
                          │
                          ▼
                  Real-time / Email
                    communication
```

------------------------------------------------------------------------

# Project Structure

``` text
phone-email-app/
│
├── client/                              # React + Vite frontend
│   ├── public/
│   │   ├── favicon.svg
│   │   └── icons.svg
│   │
│   ├── src/
│   │   ├── assets/
│   │   │   ├── hero.png
│   │   │   ├── react.svg
│   │   │   └── vite.svg
│   │   │
│   │   ├── components/
│   │   │   ├── Dashboard.jsx
│   │   │   └── Login.jsx
│   │   │
│   │   ├── services/
│   │   │   └── api.js
│   │   │
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── index.css
│   │   └── main.jsx
│   │
│   ├── index.html
│   ├── vite.config.js
│   ├── eslint.config.js
│   └── package.json
│
├── server/
│   ├── src/
│   │   ├── config/
│   │   │   └── db.js
│   │   │
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   ├── ivrController.js
│   │   │   └── messageController.js
│   │   │
│   │   ├── models/
│   │   │   ├── Email.js
│   │   │   ├── Message.js
│   │   │   ├── Otp.js
│   │   │   └── User.js
│   │   │
│   │   ├── routes/
│   │   │   ├── authRoutes.js
│   │   │   ├── emailRoutes.js
│   │   │   ├── aliasRoutes.js
│   │   │   ├── ivr.js
│   │   │   ├── ivrRoutes.js
│   │   │   └── messageRoutes.js
│   │   │
│   │   ├── services/
│   │   │   ├── imapWorker.js
│   │   │   ├── ivrServer.js
│   │   │   └── smsService.js
│   │   │
│   │   ├── smtp/
│   │   │   └── smtpServer.js
│   │   │
│   │   └── server.js
│   │
│   ├── sendTestEmail.js
│   ├── testSms.js
│   └── package.json
│
└── README.md
```

> The repository contains some legacy/duplicate backend modules,
> particularly around messaging and IVR. The structure above documents
> the current project as it exists.

------------------------------------------------------------------------

# API Endpoints

## Authentication

### Send OTP

``` http
POST /api/auth/send-otp
```

Example:

``` json
{
  "phone": "9876543210"
}
```

### Verify OTP

``` http
POST /api/auth/verify-otp
```

Example:

``` json
{
  "phone": "9876543210",
  "otp": "123456"
}
```

### Update Profile

``` http
PUT /api/auth/profile
```

### Delete Account

``` http
DELETE /api/auth/account/:phone
```

------------------------------------------------------------------------

## Messaging

### Get Messages

``` http
GET /api/email/messages/:phone
```

### Send Message

``` http
POST /api/email/send
```

### Delete Message

``` http
DELETE /api/email/message/:id
```

### Delete Thread

``` http
DELETE /api/email/thread/:identifier
```

------------------------------------------------------------------------

## IVR Endpoints

The repository contains IVR routes, but these should be considered
**prepared/inactive functionality** until a production voice
number/provider is connected.

Example route:

``` http
POST /api/ivr/incoming-call
```

The IVR implementation includes a flow where a caller can press `1` and
the application can create an account associated with the caller's phone
number.

------------------------------------------------------------------------

# Environment Variables

## Backend

Create:

``` text
server/.env
```

Example:

``` env
PORT=10000

MONGO_URI=your_mongodb_connection_string

MESSAGECENTRAL_CUSTOMER_ID=your_customer_id
MESSAGECENTRAL_KEY=your_encoded_key

EMAIL_USER=your_email_address
EMAIL_PASS=your_email_password
```

Depending on the email configuration, additional SMTP/IMAP credentials
may be required.

### Never commit secrets

Do not commit:

``` text
.env
.env.local
.env.production
```

Never expose:

-   MongoDB credentials
-   SMTP passwords
-   IMAP passwords
-   SMS provider credentials
-   API keys
-   Authentication secrets

------------------------------------------------------------------------

# Frontend Environment Variables

Create:

``` text
client/.env
```

For production:

``` env
VITE_BACKEND_URL=https://rizzmail-backend.onrender.com
```

For local development:

``` env
VITE_BACKEND_URL=http://localhost:10000
```

The frontend automatically converts the backend URL into the API base
URL:

``` text
http://localhost:10000/api
```

or:

``` text
https://rizzmail-backend.onrender.com/api
```

------------------------------------------------------------------------

# Local Development

## Requirements

Install:

-   Node.js
-   npm
-   MongoDB

Check versions:

``` bash
node --version
npm --version
```

------------------------------------------------------------------------

## Backend

``` bash
cd server
npm install
```

Create:

``` text
server/.env
```

Add the required environment variables.

Start development mode:

``` bash
npm run dev
```

Or start normally:

``` bash
npm start
```

------------------------------------------------------------------------

## Frontend

Open another terminal:

``` bash
cd client
npm install
```

Create:

``` text
client/.env
```

Add:

``` env
VITE_BACKEND_URL=http://localhost:10000
```

Start Vite:

``` bash
npm run dev
```

------------------------------------------------------------------------

# Production Build

Build the frontend:

``` bash
cd client
npm run build
```

Preview the production build:

``` bash
npm run preview
```

------------------------------------------------------------------------

# Development Architecture

``` text
                  ┌─────────────────────┐
                  │     RizzMail UI     │
                  │     React + Vite    │
                  └──────────┬──────────┘
                             │
                ┌────────────┴────────────┐
                │                         │
                ▼                         ▼
           REST API                  Socket.IO
                │                         │
                ▼                         │
          ┌───────────┐◄──────────────────┘
          │  Express  │
          └─────┬─────┘
                │
        ┌───────┴────────┐
        │                │
        ▼                ▼
    MongoDB        Email Services
                       │
                 ┌─────┴─────┐
                 ▼           ▼
               SMTP         IMAP
```

------------------------------------------------------------------------

# Why This Architecture?

The project intentionally combines several communication mechanisms
instead of relying on a single messaging API.

### REST API

Used for predictable request/response operations such as:

-   Authentication
-   Loading messages
-   Sending messages
-   Updating profiles
-   Deleting messages

### WebSockets / Socket.IO

Used where the user benefits from immediate updates:

-   New inbox messages
-   Live communication
-   Targeted inbox synchronization

### MongoDB

Provides persistent storage for application data.

### SMTP

Provides a path for receiving email into the application.

### IMAP

Provides synchronization with an existing external mailbox.

### SMS / OTP

Provides phone-based authentication.

### IVR

The architecture is prepared for voice interaction, but production
activation requires an appropriate voice-enabled number/provider
account.

------------------------------------------------------------------------

# Current Feature Status

  Feature                             Status
  ----------------------------------- -------------------
  React frontend                      Implemented
  Vite build system                   Implemented
  Node.js backend                     Implemented
  Express REST API                    Implemented
  MongoDB persistence                 Implemented
  Mongoose models                     Implemented
  Phone-number identity               Implemented
  OTP authentication                  Implemented
  MessageCentral SMS integration      Implemented
  Real-time Socket.IO communication   Implemented
  Custom SMTP ingestion               Implemented
  IMAP synchronization                Implemented
  Email parsing                       Implemented
  Production frontend deployment      Live
  Production backend deployment       Live
  IVR code/architecture               Present
  Production IVR telephone number     **Not available**
  Production IVR service              **Not active**

------------------------------------------------------------------------

# IVR: Future Implementation Plan

With the required resources, IVR can be enabled through a voice provider
such as Twilio, Telnyx, or another suitable provider.

The implementation path would be:

``` text
1. Obtain voice/toll-free number
              │
              ▼
2. Configure provider webhook
              │
              ▼
3. Point webhook to RizzMail backend
              │
              ▼
4. Enable IVR routes/controller
              │
              ▼
5. Connect caller input to application logic
              │
              ▼
6. Use MongoDB for account/message operations
              │
              ▼
7. Return voice/TwiML response
```

The current repository already contains the application-side IVR logic,
so the missing piece is primarily the production telephony resource and
provider configuration.

------------------------------------------------------------------------

# Security Notes

The project uses environment variables for credentials and service
configuration.

For production:

-   Keep secrets outside source control.
-   Use strong database credentials.
-   Restrict CORS to trusted frontend domains.
-   Never expose API keys in frontend code.
-   Never commit `.env` files.
-   Use provider-side security controls for SMTP, SMS, and future voice
    integrations.

The current development server uses permissive CORS settings, so
production hardening should restrict allowed origins to the deployed
frontend.

------------------------------------------------------------------------

# Troubleshooting

## Backend cannot connect to MongoDB

Check:

``` env
MONGO_URI=...
```

Make sure the MongoDB connection string is valid and the database is
accessible.

## Frontend cannot reach backend

Check:

``` env
VITE_BACKEND_URL=http://localhost:10000
```

Also verify that the backend is running.

## Real-time messages are not appearing

Check:

1.  Socket.IO is running on the backend.
2.  The frontend is connected to the correct backend.
3.  The user joined the correct inbox room.
4.  Browser developer tools show no WebSocket errors.

## OTP is not received

Check the MessageCentral credentials in:

``` text
server/.env
```

and verify that the SMS provider configuration is active.

## SMTP/IMAP is not working

Check the credentials and configuration used by:

``` text
server/src/smtp/smtpServer.js
server/src/services/imapWorker.js
```

------------------------------------------------------------------------

# Useful Commands

### Start backend

``` bash
cd server
npm run dev
```

### Start frontend

``` bash
cd client
npm run dev
```

### Build frontend

``` bash
cd client
npm run build
```

### Lint frontend

``` bash
cd client
npm run lint
```

------------------------------------------------------------------------

# Project Goals

RizzMail is built around the idea of combining:

-   **Phone-number identity**
-   **Email-style communication**
-   **Real-time messaging**
-   **Traditional email infrastructure**
-   **OTP-based authentication**
-   **A modern web interface**
-   **Future voice/IVR capabilities**

The project is intentionally designed so that additional communication
features can be added without replacing the existing architecture.

Potential future extensions include:

-   IVR
-   Contact management
-   Message search
-   Read receipts
-   Typing indicators
-   Message reactions
-   Attachments
-   Spam filtering
-   Email aliases
-   Stronger authentication
-   Push notifications
-   Improved conversation/thread management

------------------------------------------------------------------------

# Final Note

RizzMail was developed as a **solo project**, which meant that some
production integrations were limited by access to paid infrastructure
and provider requirements rather than by the application architecture
itself.

The core web application is deployed and functional, while the IVR layer
remains a prepared extension that can be activated when the required
telephony resources become available.

The project demonstrates a complete full-stack workflow:

``` text
React + Vite
     │
     ▼
REST API + Socket.IO
     │
     ▼
Node.js + Express
     │
     ├──────────────► MessageCentral / OTP
     │
     ├──────────────► SMTP
     │
     ├──────────────► IMAP
     │
     ▼
MongoDB
     │
     ▼
Real-time communication + Email workflow
```

This is the current architecture of RizzMail and represents the
foundation for extending the application into a broader phone-first
communication platform.

------------------------------------------------------------------------

# License

No specific open-source license has been selected yet.

If this repository is published publicly, add the preferred license
before distribution.

Example:

``` text
Copyright © 2026 RizzMail.
All rights reserved.
```

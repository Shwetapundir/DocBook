# DocBook — AI-Powered Doctor Appointment Booking System

A full-stack healthcare web application that enables patients to discover doctors, book appointments, reschedule appointments, and communicate with doctors in real time. The platform also includes an AI-powered chatbot that automates appointment booking and rescheduling workflows.

---

# 🌟 Core Features

## 👤 Authentication & Authorization

* JWT-based secure authentication
* Role-based access control (**Patient / Doctor / Admin**)
* Bcrypt password hashing
* Protected routes for all sensitive operations

---

## 🧑‍⚕️ Doctor Management

* Doctors register and submit profiles for admin approval
* Profile includes specialization, qualification, experience, fee, and hospital details
* Weekly doctor availability slot management
* Admin approval before doctor becomes visible to patients

---

## 📅 Appointment Booking

* Patients browse and filter doctors by specialization
* Real-time slot availability checking
* Double-booking prevention using PostgreSQL transactions
* Appointment lifecycle tracking (**Pending → Confirmed → Completed**)
* Payment required before appointment is confirmed (Stripe Checkout)

---

## 💳 Payment Gateway (Stripe)

* Stripe Checkout integration for secure online payments
* Consultation fee charged in INR before appointment is created
* Stripe webhook verifies payment and auto-creates the appointment on success
* Payment verification page shows confirmed appointment details
* Cancellation page with retry flow — no charge if payment is abandoned
* Payment records stored in `payments` table with status tracking (`pending`, `paid`, `failed`, `refunded`)

---

## 🔄 Appointment Rescheduling (AI Chatbot Flow)

* Logged-in patients can reschedule only upcoming appointments
* Fetches patient-specific appointments
* Displays available slots for selected doctor and date
* Excludes already booked slots
* Updates appointment after confirmation

### Backend Tools Used

* `getUpcomingAppointments(patientId)`
* `getAvailableSlots(doctorId, date)`
* `rescheduleAppointment(appointmentId, newDate, newSlot)`

---

## 🤖 AI Chatbot Appointment Booking

* Patient describes symptoms
* LLM maps symptoms to disease category
* Fetches doctors by specialization
* Shows available slots
* Confirms and creates appointment

### Example Mapping

* Fever + cough → General Physician
* Tooth pain → Dentist
* Skin rash → Dermatologist

---

## 💬 Real-Time Chat

* Patients can chat with doctors after appointment booking
* Polling every 3 seconds for near real-time updates
* Unread message notification badge
* Read receipts support

---

## 🛡️ Admin Panel

* Approve / reject doctor registrations
* Manage users (activate/deactivate)
* Platform statistics dashboard

---

# 🛠️ Tech Stack

| Layer          | Technology                    |
| -------------- | ----------------------------- |
| Frontend       | React.js, React Router, Axios |
| Backend        | Node.js, Express.js           |
| Database       | PostgreSQL                    |
| Authentication | JWT, Bcrypt                   |
| AI Integration | LangChain / LLM               |
| Payment        | Stripe Checkout               |
| Styling        | Custom CSS                    |
| Real-time      | Polling (3s interval)         |

---

# 📁 Project Structure

```bash
DOCBOOK/
├── backend/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── routes/
│   ├── services/
│   ├── chatbot-tools/
│   └── server.js
│
└── frontend/
    ├── public/
    └── src/
        ├── api/
        ├── components/
        ├── context/
        ├── pages/
        └── App.js
```

---

# 🚀 Getting Started

## Prerequisites

* Node.js v16+
* PostgreSQL v14+
* npm

---

## Clone Repository

```bash
git clone https://github.com/Shwetapundir/DocBook.git
cd DOCBOOK
```

---

## Backend Setup

```bash
cd backend
npm install
```

Create `.env`

```env
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=doctor_booking
DB_USER=postgres
DB_PASSWORD=your_postgres_password
JWT_SECRET=your_super_secret_jwt_key
JWT_EXPIRES_IN=7d
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_stripe_webhook_secret
FRONTEND_URL=http://localhost:3000
```

Run migrations:

```bash
node config/migrate.js
node config/migrate_payments.js
```

Start backend:

```bash
npm run dev
```

Backend runs at:

`http://localhost:5000`

---

## Frontend Setup

```bash
cd frontend
npm install
npm start
```

Frontend runs at:

`http://localhost:3000`

---

# 🔐 Default Admin Account

Email: `admin@docbook.com`
Password: `Admin@123`

---

# 📡 Major API Modules

## Auth

* Register
* Login
* Current user

## Doctors

* List approved doctors
* Doctor profile
* Availability

## Appointments

* Book appointment
* View appointments
* Cancel / update status

## Payments

* Create Stripe Checkout session
* Stripe webhook (payment confirmation + appointment creation)
* Verify payment by session ID

## Chat

* Conversations
* Send / receive messages

## Admin

* Approvals
* User control
* Statistics

---

# 🗄️ Core Database Modules

* users
* doctor_profiles
* availability
* appointments
* payments
* conversations
* messages

---

# 🔒 Security Features

* JWT expiry-based authentication
* Bcrypt hashing
* Role-based middleware
* Input validation
* Helmet.js security headers
* Rate limiting
* PostgreSQL SERIALIZABLE transactions

---

# 💡 AI Chatbot Architecture

Patient → Chatbot → LangChain Tool → Doctor Database → Slot Engine → Stripe Checkout → Webhook → Appointment Database

---

# 🔄 Payment Flow

1. Patient selects a doctor and time slot
2. Frontend calls `/api/payments/create-checkout-session`
3. Backend validates the slot and creates a Stripe Checkout session
4. Patient is redirected to Stripe-hosted payment page
5. On success, Stripe fires a webhook → backend confirms payment and creates the appointment
6. Patient lands on `/payment/success?session_id=...` — payment is verified and appointment details are shown
7. On cancel, patient lands on `/payment/cancel` — no charge, no appointment created

---

# 🙌 Acknowledgements

Built using React, Node.js, Express, PostgreSQL, LangChain, and Stripe.

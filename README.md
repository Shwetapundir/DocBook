# 🏥 DocBook — Doctor Appointment Booking System

A full-stack web application that allows patients to find doctors, book appointments, and chat with their doctors in real time.

---

## 🌟 Features

### 👤 Authentication
- JWT-based secure authentication
- Role-based access control (Patient, Doctor, Admin)
- Bcrypt password hashing

### 🧑‍⚕️ Doctor Management
- Doctors register and submit profiles for admin approval
- Specialization, qualification, experience, fee, hospital info
- Weekly availability slot management

### 📅 Appointment Booking
- Patients browse and filter doctors by specialization
- Real-time slot availability checking
- Double-booking prevention with PostgreSQL transactions
- Appointment status tracking (Pending → Confirmed → Completed)

### 💬 Real-Time Chat
- Patients can chat with doctors they have appointments with
- Message polling every 3 seconds for near real-time updates
- Unread message badge in navbar
- Message read receipts

### 🛡️ Admin Panel
- Approve or reject doctor registrations
- Manage all users (activate/deactivate)
- Platform statistics dashboard

---

## 🛠️ Tech Stack

| Layer       | Technology                        |
|-------------|-----------------------------------|
| Frontend    | React.js, React Router, Axios     |
| Backend     | Node.js, Express.js               |
| Database    | PostgreSQL                        |
| Auth        | JWT, Bcrypt                       |
| Styling     | Custom CSS (Sora + DM Sans fonts) |
| Real-time   | Polling (3s interval)             |

---

## 📁 Project Structure

```
doctor-booking/
├── backend/
│   ├── config/
│   │   ├── db.js               # PostgreSQL connection
│   │   ├── schema.sql          # Database schema
│   │   └── migrate.js          # Migration script
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── doctorController.js
│   │   ├── appointmentController.js
│   │   ├── adminController.js
│   │   └── chatController.js
│   ├── middleware/
│   │   ├── auth.js             # JWT middleware
│   │   ├── errorHandler.js
│   │   └── validate.js         # Input validation
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── doctorRoutes.js
│   │   ├── appointmentRoutes.js
│   │   ├── adminRoutes.js
│   │   └── chatRoutes.js
│   ├── server.js
│   └── package.json
│
└── frontend/
    ├── public/
    │   └── index.html
    └── src/
        ├── api/
        │   ├── axios.js            # Axios instance with interceptors
        │   └── services.js         # API service functions
        ├── components/
        │   └── common/
        │       ├── Navbar.jsx
        │       └── ProtectedRoute.jsx
        ├── context/
        │   └── AuthContext.js      # Global auth state
        ├── pages/
        │   ├── LoginPage.jsx
        │   ├── RegisterPage.jsx
        │   ├── DoctorListPage.jsx
        │   ├── BookAppointmentPage.jsx
        │   ├── ChatPage.jsx
        │   ├── patient/
        │   │   └── PatientDashboard.jsx
        │   ├── doctor/
        │   │   ├── DoctorDashboard.jsx
        │   │   └── DoctorProfilePage.jsx
        │   └── admin/
        │       └── AdminDashboard.jsx
        ├── App.js
        └── index.css
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js v16+
- PostgreSQL v14+
- npm

---

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/doctor-booking.git
cd doctor-booking
```

---

### 2. Setup the database

Open PostgreSQL and create the database:

```sql
CREATE DATABASE doctor_booking;
```

---

### 3. Setup the backend

```bash
cd backend
npm install
```

Create a `.env` file in the `backend` folder:

```env
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=doctor_booking
DB_USER=postgres
DB_PASSWORD=your_postgres_password
JWT_SECRET=your_super_secret_jwt_key
JWT_EXPIRES_IN=7d
NODE_ENV=development
```

Run the database migration:

```bash
node config/migrate.js
```

Start the backend server:

```bash
npm run dev
```

Backend runs on **http://localhost:5000**

---

### 4. Setup the frontend

```bash
cd frontend
npm install
npm start
```

Frontend runs on **http://localhost:3000**

---

## 🔐 Default Admin Account

```
Email:    admin@docbook.com
Password: Admin@123
```

---

## 📡 API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login |
| GET  | `/api/auth/me` | Get current user |

### Doctors
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | `/api/doctors` | List all approved doctors |
| GET  | `/api/doctors/:id` | Get doctor details |
| POST | `/api/doctors/profile` | Create/update doctor profile |
| GET  | `/api/doctors/:id/availability` | Get available slots |

### Appointments
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/appointments` | Book appointment |
| GET  | `/api/appointments` | Get my appointments |
| PATCH | `/api/appointments/:id/cancel` | Cancel appointment |
| PATCH | `/api/appointments/:id/status` | Update status (doctor) |

### Chat
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | `/api/chat/conversations` | Get my conversations |
| POST | `/api/chat/conversations` | Start a conversation |
| GET  | `/api/chat/conversations/:id/messages` | Get messages |
| POST | `/api/chat/conversations/:id/messages` | Send a message |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | `/api/admin/stats` | Platform statistics |
| GET  | `/api/admin/doctors/pending` | Pending doctor approvals |
| PATCH | `/api/admin/doctors/:id/approve` | Approve doctor |
| PATCH | `/api/admin/doctors/:id/reject` | Reject doctor |
| GET  | `/api/admin/users` | All users |
| PATCH | `/api/admin/users/:id/toggle` | Activate/deactivate user |

---

## 🗄️ Database Schema

```
users
├── id (UUID)
├── full_name
├── email (unique)
├── password (hashed)
├── role (patient/doctor/admin)
├── phone
├── is_active
└── created_at

doctor_profiles
├── id (UUID)
├── user_id → users
├── specialization
├── qualification
├── experience_years
├── consultation_fee
├── hospital_name
├── bio
├── is_approved
└── created_at

availability
├── id (UUID)
├── doctor_id → users
├── day_of_week (0-6)
├── start_time
├── end_time
└── is_active

appointments
├── id (UUID)
├── patient_id → users
├── doctor_id → users
├── appointment_date
├── start_time
├── end_time
├── status (pending/confirmed/completed/cancelled)
├── reason
├── notes
└── created_at

conversations
├── id (UUID)
├── patient_id → users
├── doctor_id → users
├── appointment_id → appointments
├── last_message
└── last_message_at

messages
├── id (UUID)
├── conversation_id → conversations
├── sender_id → users
├── message
├── is_read
└── created_at
```

---

## 🔒 Security Features

- JWT authentication with expiry
- Bcrypt password hashing (10 rounds)
- Role-based route protection
- Input validation on all endpoints
- CORS protection
- Helmet.js security headers
- Rate limiting on auth routes
- SERIALIZABLE transactions for booking
- Chat access restricted to users with appointments

---

## 🙌 Acknowledgements

Built with React, Node.js, Express, and PostgreSQL.

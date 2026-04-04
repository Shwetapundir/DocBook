import API from "./axios";

export const authAPI = {
  register: (data) => API.post("/auth/register", data),
  login:    (data) => API.post("/auth/login", data),
  getMe:    ()     => API.get("/auth/me"),
};

export const doctorAPI = {
  getAll:          (params)     => API.get("/doctors", { params }),
  getById:         (id)         => API.get(`/doctors/${id}`),
  getAvailability: (id, date)   => API.get(`/doctors/${id}/availability`, { params: { date } }),
  upsertProfile:   (data)       => API.post("/doctors/profile", data),
  addAvailability: (data)       => API.post("/doctors/availability", data),
  removeAvailability: (slotId)  => API.delete(`/doctors/availability/${slotId}`),
  getMyAppointments: (params)   => API.get("/doctors/me/appointments", { params }),
  updateNotes: (id, notes)      => API.patch(`/doctors/appointments/${id}/notes`, { notes }),
  updateAppointmentStatus: (id, status) => API.patch(`/appointments/${id}/status`, { status }),
};

export const appointmentAPI = {
  book:   (data)              => API.post("/appointments", data),
  getAll: (params)            => API.get("/appointments", { params }),
  cancel: (id, cancel_reason) => API.patch(`/appointments/${id}/cancel`, { cancel_reason }),
};

export const adminAPI = {
  getStats:          ()       => API.get("/admin/stats"),
  getUsers:          (params) => API.get("/admin/users", { params }),
  getPendingDoctors: ()       => API.get("/admin/doctors/pending"),
  approveDoctor:     (id)     => API.patch(`/admin/doctors/${id}/approve`),
  rejectDoctor:      (id)     => API.patch(`/admin/doctors/${id}/reject`),
  toggleUserActive:  (id)     => API.patch(`/admin/users/${id}/toggle-active`),
  getAppointments:   (params) => API.get("/admin/appointments", { params }),
};

export const chatbotAPI = {
  // Get or create the active AI conversation for this user
  getOrCreateConversation: () =>
    API.post('/chatbot/conversations'),

  // Start a brand-new AI conversation (archives the previous one)
  newConversation: () =>
    API.post('/chatbot/conversations/new'),

  // Fetch message history for a conversation
  getMessages: (conversationId) =>
    API.get(`/chatbot/conversations/${conversationId}/messages`),

  // Send a user message and receive the AI reply
  sendMessage: (conversationId, message) =>
    API.post(`/chatbot/conversations/${conversationId}/messages`, { message }),
};

export const paymentAPI = {
  createCheckoutSession: (data) => API.post("/payments/create-checkout-session", data),
  verifyPayment: (sessionId) => API.get("/payments/verify", { params: { session_id: sessionId } }),
};

export const chatAPI = {
  // Get all conversations for logged-in user
  getConversations: () =>
    API.get("/chat/conversations"),

  // Start or get a conversation with a doctor (patient only)
  startConversation: (doctor_id) =>
    API.post("/chat/conversations", { doctor_id }),

  // Get all messages in a conversation
  getMessages: (conversationId) =>
    API.get(`/chat/conversations/${conversationId}/messages`),

  // Send a message
  sendMessage: (conversationId, message) =>
    API.post(`/chat/conversations/${conversationId}/messages`, { message }),
};
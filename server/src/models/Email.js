const emailSchema = new mongoose.Schema({
  phoneNumber: String,
  emailAddress: String,
  recipient: String,
  sender: String,
  subject: String,
  body: String,
  senderName: { type: String, default: '' },   // <-- Required
  senderPhoto: { type: String, default: '' },  // <-- Required
  direction: String,
  date: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});
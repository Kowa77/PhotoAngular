import { createTransport } from "nodemailer";
// import nodemailer from "nodemailer";

const userGmail = "esteban.garriga@gmail.com";
const passAppGmail = "sgew wdkm adix dvgk";

// Set up Nodemailer transporter
const transporter = createTransport({
  service: "gmail",
  auth: {
    user: userGmail,
    pass: passAppGmail,
  },
});

// Define a route for sending emails
// Set up email options
const mailOptions = {
  from: userGmail,
  to: userGmail,
  subject: "Test Email 222",
  text: "This is a test email from Node.js!",
};

// Send email
transporter.sendMail(mailOptions, (error, info) => {
  if (error) {
    console.log(error);
  }
  console.log("Email sent: " + info.response);
});

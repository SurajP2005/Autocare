# 🚗 AutoCare – Smart Automotive Solutions

**AutoCare** is a full-stack vehicle-care web application designed to help users manage vehicle information, track maintenance, monitor fuel efficiency, and organize vehicle-related expenses in one place.

🌐 **Live Demo:** [https://autocare-aip3.onrender.com](https://autocare-aip3.onrender.com)

## ✨ Features

- **Vehicle Management:** Add and manage vehicle details.
- **Service History:** Record and review vehicle servicing information.
- **Fuel Tracking:** Track fuel entries and calculate mileage using the full-tank-to-full-tank method.
- **Expense Tracking:** Record vehicle-related expenses and view expense summaries.
- **Maintenance Reminders:** Track maintenance based on dates and odometer readings.
- **Document Management:** Upload and manage vehicle documents using Cloudinary.
- **Vehicle Dashboard:** View vehicle-specific information, service records, fuel data, and expenses.
- **AI Assistant:** Get vehicle-related assistance through an integrated AI service.
- **Authentication:** Secure user access with authentication and session management.

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| Node.js | JavaScript runtime |
| Express.js | Backend framework and routing |
| MongoDB Atlas | Cloud database |
| Mongoose | MongoDB object modeling |
| EJS | Server-side page rendering |
| JavaScript | Application logic |
| Bootstrap | Responsive user interface |
| Passport.js | Authentication |
| Cloudinary | Document and file storage |
| Google Gemini API | AI-powered assistance |
| Render | Application deployment |

## ⚙️ Getting Started

### Prerequisites

- Node.js and npm
- A MongoDB database or MongoDB Atlas account
- Cloudinary account for document uploads
- Google Gemini API key for AI features

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/SurajP2005/Autocare.git
   ```

2. Navigate to the project directory:

   ```bash
   cd Autocare
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

4. Create a `.env` file in the project root and configure the environment variables required by the application.

   Add your own credentials locally. **Never commit your `.env` file or publish API keys, database passwords, or session secrets.**

5. Start the application using the start command configured in `package.json`.

6. Open the local URL shown in your terminal.

## 🔐 Environment Configuration

Configure the environment variables expected by the application for:

- MongoDB connection
- Session secret
- Cloudinary credentials
- Google Gemini API key

Refer to the application's configuration and source code for the exact variable names required.

## 🚀 Deployment

AutoCare is deployed on Render and uses MongoDB Atlas for cloud database hosting.

Visit the live application: [AutoCare](https://autocare-aip3.onrender.com)

## 🎯 Project Objective

The objective of AutoCare is to simplify vehicle ownership by bringing maintenance records, fuel monitoring, expenses, reminders, and vehicle documents together in one application.

## 👨‍💻 Developer

**Suraj Mahendra Pawar**

- GitHub: [SurajP2005](https://github.com/SurajP2005)
- Project Repository: [AutoCare](https://github.com/SurajP2005/Autocare)
- Live Application: [AutoCare Live Demo](https://autocare-aip3.onrender.com)

---

*Built as a full-stack web development project to explore backend development, database integration, cloud services, authentication, and AI integration.*

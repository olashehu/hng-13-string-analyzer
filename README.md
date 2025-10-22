
## 🧠 String Analyzer API
A RESTful API built with NestJS and TypeORM that analyzes input strings and computes various properties such as length, palindrome status, unique characters, word count, SHA-256 hash, and character frequency.
It also supports filtering, querying by natural language, and error handling.

## 🚀 Features
✅ Analyze and store string properties
✅ Retrieve a single analysis by value
✅ Delete analyzed strings
✅ Filter analyzed strings via query params
✅ Natural language filtering (e.g., “all single word palindromic strings”)
✅ Centralized error handling and validation
✅ TypeORM integration with PostgreSQL

## 🧩 Technologies Used
1. NestJS – Backend framework

2. TypeORM – ORM for database interactions

3. PostgreSQL
 – Relational database

4. class-validator
 – Input validation

5. crypto
 – For hashing

6. nodemon
 – Auto-restart in development

## Project setup
### 1️⃣ Clone the Repository
```
git clone https://github.com/<your-username>/string-analyzer-api.git
cd string-analyzer-api
```
### 2️⃣ Install Dependencies
Make sure you have Node.js ≥ 18 and npm or yarn installed.
```
npm install
# or
yarn install
```
### 3️⃣ Configure Environment Variables
Create a .env file in the project root with the following variables:
```
# App
PORT=3000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=yourpassword
DB_NAME=string_analyzer_db
```
### 4️⃣ Set Up Database
Make sure PostgreSQL is running locally.
Then, create the database:
```
createdb string_analyzer_db
```
(Optional) Run migrations if applicable:
```
npm run typeorm migration:run
```

### 5️⃣ Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```
Your API will be available at 👉 http://localhost:3000

## 🧪 Example Endpoints
### Analyze a String
### POST /strings
```json
{
  "value": "madam"
}
```
## Get a String Analysis
### GET```/strings/madam```
## Get All with Filters
##  GET```/strings?is_palindrome=true&min_length=3&contains_character=a```
## Filter by Natural Language
### GET```/strings/filter-by-natural-language?query=all%20single%20word%20palindromic%20strings```

## 📦 Dependencies
| Package           | Description                      |
| ----------------- | -------------------------------- |
| `@nestjs/common`  | Core NestJS utilities            |
| `@nestjs/core`    | NestJS framework core            |
| `@nestjs/typeorm` | TypeORM integration              |
| `typeorm`         | Database ORM                     |
| `pg`              | PostgreSQL driver                |
| `crypto`          | Built-in Node module for hashing |
| `nodemon`         | Development auto-reload          |
| `class-validator` | Request validation               |

Install with:
```bash
npm install @nestjs/common @nestjs/core @nestjs/typeorm typeorm pg class-validator
npm install --save-dev nodemon
```

## ⚙️ Example Scripts in package.json
```json
{
  "scripts": {
    "start": "nest start",
    "start:dev": "nodemon --watch src --exec ts-node src/main.ts",
    "start:prod": "node dist/main.js",
    "build": "nest build",
    "format": "prettier --write \"src/**/*.ts\""
  }
}
```
## 🧾 Example Success Response
```json
{
  "id": "6a2c12e7a87f...",
  "value": "madam",
  "properties": {
    "length": 5,
    "is_palindrome": true,
    "unique_characters": 3,
    "word_count": 1,
    "sha256_hash": "6a2c12e7a87f...",
    "character_frequency_map": {
      "m": 2,
      "a": 2,
      "d": 1
    }
  },
  "created_at": "2025-10-11T10:00:00Z"
}
```
## 🧰 Development Tips
1. Use Postman or Insomnia to test the API endpoints.

2. Log database queries by enabling logging: true in your TypeORM config.

3. For better error visibility, implement a global exception filter.

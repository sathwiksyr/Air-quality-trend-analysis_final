pipeline {
    agent any

    environment {
        MONGO_URL = credentials('MONGO_URL')
        JWT_SECRET = credentials('JWT_SECRET')
        GOOGLE_CLIENT_ID = credentials('GOOGLE_CLIENT_ID')
        GOOGLE_CLIENT_SECRET = credentials('GOOGLE_CLIENT_SECRET')
        BACKEND_URL = "http://localhost:5000"
        FRONTEND_URL = "http://localhost:3000"
    }

    stages {

        stage('Checkout Code') {
            steps {
                git branch: 'main',
                    url: 'https://github.com/YOUR_USERNAME/YOUR_REPO.git'
            }
        }

        stage('Create .env file') {
            steps {
                writeFile file: '.env', text: """
MONGO_URL=${MONGO_URL}
JWT_SECRET=${JWT_SECRET}
GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
BACKEND_URL=${BACKEND_URL}
FRONTEND_URL=${FRONTEND_URL}
"""
            }
        }

        stage('Stop Old Containers') {
            steps {
                bat 'docker compose down'
            }
        }

        stage('Build Images') {
            steps {
                bat 'docker compose build'
            }
        }

        stage('Deploy Containers') {
            steps {
                bat 'docker compose up -d'
            }
        }

        stage('Verify Running') {
            steps {
                bat 'docker ps'
            }
        }
    }
}
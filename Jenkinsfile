pipeline {
    agent any

    environment {
        EC2_HOST = "98.95.48.30"
        EC2_USER = "ubuntu"
        APP_DIR  = "/home/ubuntu/Air-quality-trend-analysis_final"
    }

    stages {
        stage('Checkout Code') {
            steps {
                git branch: 'main',
                    url: 'https://github.com/sathwiksyr/Air-quality-trend-analysis_final.git'
            }
        }

        stage('Deploy to EC2') {
            steps {
                sshagent(credentials: ['ec2-ssh-key']) {
                    bat """
                        ssh -o StrictHostKeyChecking=no %EC2_USER%@%EC2_HOST% "cd %APP_DIR% && git pull origin main && docker compose down && docker compose up -d --build && docker ps"
                    """
                }
            }
        }
    }

    post {
        success {
            echo 'Deployment Successful'
        }
        failure {
            echo 'Deployment Failed'
        }
    }
}
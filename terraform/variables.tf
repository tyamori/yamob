# terraform/variables.tf

variable "github_token" {
  type        = string
  description = "GitHub Personal Access Token for Amplify to access the repository"
  sensitive   = true
}

variable "aws_region" {
  type        = string
  description = "AWS region to deploy resources"
  default     = "ap-northeast-1"
} 
output "elastic_ip" {
  description = "Stable public IP — point the mobile app EXPO_PUBLIC_API_URL here (http://IP:5020)."
  value       = aws_eip.app.public_ip
}

output "instance_id" {
  value = aws_instance.app.id
}

output "ssh_hint" {
  description = "SSH only works if key_name was set; otherwise use AWS Systems Manager Session Manager."
  value       = var.key_name != "" ? "ssh -i /path/to/key.pem ec2-user@${aws_eip.app.public_ip}" : "Use SSM: aws ssm start-session --target ${aws_instance.app.id}"
}

output "api_base_url" {
  value = "http://${aws_eip.app.public_ip}:${var.api_port}"
}

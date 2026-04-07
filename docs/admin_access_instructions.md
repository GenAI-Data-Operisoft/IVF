# IVF Witness Capture System - Admin Access Instructions

**CONFIDENTIAL - FOR AUTHORIZED PERSONNEL ONLY**

---

## System Access Information

### Frontend Application Access
- **Production URL:** https://d1nmtja0c4ok3x.cloudfront.net
- **Status:** ✅ Active and Secure (HTTPS enforced)
- **Browser Requirements:** Modern browsers with JavaScript enabled
- **Network Requirements:** Internet access (no VPN required)

### Admin User Credentials
**⚠️ SECURITY NOTICE:** These credentials provide full administrative access to the IVF system. Handle with extreme care.

- **User Pool:** IVF-WitnessCapture-Users
- **Admin Email:** admin@example.com
- **User Status:** CONFIRMED and ACTIVE
- **Role:** Administrator (full system access)
- **Department:** IT

**Note:** The password was set during deployment. Please contact the deployment team for the secure password or use the password reset functionality.

---

## Step-by-Step Access Instructions

### Initial Login Process

1. **Navigate to the Application**
   - Open your web browser
   - Go to: https://d1nmtja0c4ok3x.cloudfront.net
   - Verify the SSL certificate shows as secure (🔒)

2. **Login to the System**
   - Click on the "Login" or "Sign In" button
   - Enter Email: `admin@example.com`
   - Enter the provided password
   - Click "Sign In"

3. **First-Time Setup (if required)**
   - You may be prompted to change your password
   - Follow the password policy requirements:
     - Minimum 8 characters
     - Include uppercase and lowercase letters
     - Include at least one number
     - Include at least one special character

4. **Verify Admin Access**
   - Once logged in, verify you can access admin functions
   - Check that you can see system metrics and user management
   - Confirm access to audit logs and system configuration

### Password Reset (if needed)

If you need to reset the admin password:

1. **Using AWS Console:**
   ```bash
   aws cognito-idp admin-set-user-password \
     --user-pool-id ap-south-1_6ApLN2CRE \
     --username admin@example.com \
     --password "NewSecurePassword123!" \
     --permanent \
     --region ap-south-1
   ```

2. **Using the Frontend:**
   - Click "Forgot Password" on the login page
   - Enter: admin@example.com
   - Follow the email instructions (if email is configured)

---

## System Administration Guide

### User Management

**Adding New Users:**
1. Log in as admin
2. Navigate to User Management section
3. Click "Add New User"
4. Fill in required information:
   - Email address
   - Name
   - Role (admin, nurse, technician)
   - Department
5. User will receive login instructions

**Managing User Roles:**
- **Admin:** Full system access, user management, system configuration
- **Nurse:** Patient data entry, case management, basic reporting
- **Technician:** Equipment operation, data validation, quality control

### System Monitoring

**Key Metrics to Monitor:**
1. **Active Sessions:** Monitor concurrent user sessions
2. **Case Processing:** Track daily case volume and processing times
3. **Error Rates:** Monitor API errors and validation failures
4. **Storage Usage:** Track S3 storage consumption
5. **Cost Monitoring:** Review monthly AWS costs

**Access Monitoring Dashboards:**
1. Log in to AWS Console (if access provided)
2. Navigate to CloudWatch
3. View IVF system dashboards
4. Set up alerts for critical metrics

### Data Management

**Backup and Recovery:**
- DynamoDB tables have point-in-time recovery available
- S3 data is automatically replicated across availability zones
- Contact AWS support for data recovery if needed

**Data Retention:**
- Audit logs: Retained indefinitely
- Case data: Retained per regulatory requirements
- Images: Archived to cost-effective storage after 90 days

---

## Troubleshooting Guide

### Common Issues and Solutions

**Issue: Cannot access the application**
- **Check:** Internet connection and firewall settings
- **Verify:** URL is correct (https://d1nmtja0c4ok3x.cloudfront.net)
- **Solution:** Clear browser cache and cookies

**Issue: Login fails with correct credentials**
- **Check:** Caps Lock and keyboard layout
- **Verify:** User account is not locked
- **Solution:** Use password reset if needed

**Issue: Slow application performance**
- **Check:** Internet connection speed
- **Verify:** No browser extensions blocking content
- **Solution:** Try different browser or incognito mode

**Issue: Images not loading or processing**
- **Check:** File format (supported: JPEG, PNG, TIFF)
- **Verify:** File size under 10MB
- **Solution:** Compress images if too large

### Emergency Contacts

**For Technical Issues:**
- AWS Support: Available through AWS Console
- System Logs: Available in CloudWatch
- Error Tracking: Check IVF-ValidationFailures table

**For Security Incidents:**
- Immediately disable affected user accounts
- Review audit logs in IVF-AuditLog table
- Contact AWS security team if needed

---

## Security Best Practices

### Password Management
- Use strong, unique passwords
- Enable multi-factor authentication when available
- Change passwords regularly (every 90 days recommended)
- Never share credentials via email or unsecured channels

### Access Control
- Review user access permissions monthly
- Remove access for departed employees immediately
- Use principle of least privilege
- Monitor login patterns for unusual activity

### Data Protection
- Never download patient data to personal devices
- Use secure networks (avoid public WiFi for admin tasks)
- Log out completely when finished
- Report any suspected security incidents immediately

---

## System Maintenance Schedule

### Daily Tasks
- [ ] Monitor system health dashboard
- [ ] Review error logs for any issues
- [ ] Check active user sessions
- [ ] Verify backup completion status

### Weekly Tasks
- [ ] Review user access and permissions
- [ ] Check system performance metrics
- [ ] Review and resolve any validation failures
- [ ] Monitor storage usage and costs

### Monthly Tasks
- [ ] User access audit
- [ ] Performance optimization review
- [ ] Cost analysis and optimization
- [ ] Security patch review

### Quarterly Tasks
- [ ] Comprehensive security audit
- [ ] Disaster recovery testing
- [ ] User training and documentation updates
- [ ] System capacity planning review

---

## API Access (Advanced Users)

### API Gateway Information
- **Base URL:** https://26wy0r8be6.execute-api.ap-south-1.amazonaws.com/prod
- **Authentication:** Cognito User Pool tokens required
- **Available Endpoints:** 15+ REST endpoints
- **Documentation:** Available in system admin panel

### Programmatic Access
For automated integrations or advanced users:

1. **Obtain Access Token:**
   ```bash
   aws cognito-idp admin-initiate-auth \
     --user-pool-id ap-south-1_6ApLN2CRE \
     --client-id 485tur8h5ju9ioph6d6cdh3ech \
     --auth-flow USER_PASSWORD_AUTH \
     --auth-parameters USERNAME=admin@example.com,PASSWORD=YourPassword \
     --region ap-south-1
   ```

2. **Use Token in API Calls:**
   ```bash
   curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
        https://26wy0r8be6.execute-api.ap-south-1.amazonaws.com/prod/models
   ```

---

## Compliance and Audit

### Regulatory Compliance
- All patient data handling follows HIPAA guidelines
- Audit trails maintained for all system activities
- Data encryption in transit and at rest
- Access controls and user authentication enforced

### Audit Trail Access
- **Audit Logs:** Available through admin dashboard
- **API Access:** GET /audit-logs endpoint
- **Database:** IVF-AuditLog table in DynamoDB
- **Retention:** Indefinite retention for compliance

### Data Privacy
- Patient data is anonymized where possible
- Access is logged and monitored
- Data sharing requires explicit authorization
- Right to deletion supported upon request

---

## Support and Escalation

### Level 1 Support (Internal IT)
- User account issues
- Basic troubleshooting
- Password resets
- Application access problems

### Level 2 Support (System Administrator)
- System configuration changes
- Performance optimization
- User role management
- Integration issues

### Level 3 Support (AWS/Vendor)
- Infrastructure issues
- Security incidents
- Data recovery
- Major system failures

### Emergency Procedures
1. **System Outage:** Check AWS Service Health Dashboard
2. **Security Breach:** Disable affected accounts, review audit logs
3. **Data Loss:** Contact AWS support for recovery options
4. **Performance Issues:** Review CloudWatch metrics and scale resources

---

## Handover Checklist

### Deployment Team to Client
- [ ] ✅ System deployed and validated
- [ ] ✅ Admin credentials provided securely
- [ ] ✅ Access instructions documented
- [ ] ✅ Monitoring configured
- [ ] ✅ Security validations completed
- [ ] ✅ Performance testing completed
- [ ] ✅ Documentation provided
- [ ] ✅ Support contacts established

### Client Acceptance
- [ ] Admin access verified
- [ ] System functionality tested
- [ ] User training completed
- [ ] Monitoring dashboards reviewed
- [ ] Security procedures understood
- [ ] Support procedures established
- [ ] Go-live date confirmed
- [ ] Acceptance sign-off completed

---

**Deployment Completion Timestamp:** March 21, 2026  
**System Status:** ✅ PRODUCTION READY  
**Next Review Date:** April 21, 2026  

---

*This document contains sensitive security information. Distribute only to authorized personnel and store securely.*
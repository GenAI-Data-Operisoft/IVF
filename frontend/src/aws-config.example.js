// Copy this file to aws-config.js and fill in your Cognito values
// aws-config.js is gitignored — never commit real credentials

const awsConfig = {
  Auth: {
    Cognito: {
      userPoolId: 'ap-south-1_XXXXXXXXX',
      userPoolClientId: 'XXXXXXXXXXXXXXXXXXXXXXXXXX',
      region: 'ap-south-1',
      loginWith: {
        email: true
      },
      signUpVerificationMethod: 'code',
      userAttributes: {
        email: { required: true },
        name: { required: true }
      },
      passwordFormat: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireNumbers: true,
        requireSpecialCharacters: false
      }
    }
  }
};

export default awsConfig;

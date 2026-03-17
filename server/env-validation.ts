/**
 * Environment Variable Validation
 * 
 * Validates required environment variables based on the environment.
 * Provides clear error messages and warnings for missing or invalid values.
 */

interface EnvConfig {
  required: string[];
  optional: string[];
  productionRequired: string[];
}

const envConfig: EnvConfig = {
  required: [
    'JWT_SECRET', // Required in both environments
  ],
  optional: [
    'SESSION_SECRET',
    'FRONTEND_URL',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
  ],
  productionRequired: [
    'DATABASE_URL', // Neon PostgreSQL connection string
    'JWT_SECRET',
    'SESSION_SECRET',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
  ]
};

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  environment: string;
}

/**
 * Validate environment variables
 */
export function validateEnvironment(isProduction: boolean): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    environment: isProduction ? 'production' : 'development'
  };

  // Check required variables
  const requiredVars = isProduction ? envConfig.productionRequired : envConfig.required;
  
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      // In development, use fallback for JWT_SECRET
      if (varName === 'JWT_SECRET' && !isProduction) {
        result.warnings.push(`${varName} not set, using development fallback`);
      } else if (varName === 'SESSION_SECRET' && !isProduction) {
        result.warnings.push(`${varName} not set, using development fallback`);
      } else if (isProduction) {
        result.errors.push(`Missing required environment variable: ${varName}`);
        result.isValid = false;
      } else {
        result.warnings.push(`${varName} not set (optional in development)`);
      }
    }
  }

  // Check optional variables and provide warnings
  for (const varName of envConfig.optional) {
    if (!process.env[varName] && !result.warnings.find(w => w.includes(varName))) {
      // Only warn about Cloudinary in production
      if (varName.startsWith('CLOUDINARY_') && isProduction) {
        result.warnings.push(`${varName} not set - file uploads will fail`);
      }
    }
  }

  // Database configuration check - PostgreSQL required for all environments
  if (!process.env.DATABASE_URL) {
    result.errors.push('DATABASE_URL is required (Neon PostgreSQL). SQLite is not supported.');
    result.isValid = false;
  }

  // Print validation results
  if (result.errors.length > 0) {
    console.error('\n❌ Environment Validation Errors:');
    result.errors.forEach(err => console.error(`   - ${err}`));
  }

  if (result.warnings.length > 0) {
    console.warn('\n⚠️ Environment Warnings:');
    result.warnings.forEach(warn => console.warn(`   - ${warn}`));
  }

  if (result.isValid) {
    console.log(`\n✅ Environment validation passed for ${result.environment}`);
  }

  return result;
}

/**
 * Get environment info for debugging
 */
export function getEnvironmentInfo() {
  const isProduction = process.env.NODE_ENV === 'production';
  const hasDatabase = !!process.env.DATABASE_URL;
  const hasCloudinary = !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );

  return {
    environment: isProduction ? 'production' : 'development',
    database: {
      type: 'PostgreSQL (Neon)',
      configured: hasDatabase
    },
    storage: {
      type: hasCloudinary && isProduction ? 'Cloudinary' : 'Local',
      configured: isProduction ? hasCloudinary : true
    },
    authentication: {
      jwtConfigured: !!process.env.JWT_SECRET || !isProduction,
      sessionConfigured: !!process.env.SESSION_SECRET || !isProduction
    }
  };
}

/**
 * Ensure all required directories exist for local development
 */
export async function ensureDirectories(): Promise<void> {
  const fs = await import('fs/promises');
  const path = await import('path');
  
  const directories = [
    'server/data',
    'server/uploads',
    'server/uploads/profiles',
    'server/uploads/gallery',
    'server/uploads/homepage',
    'server/uploads/study-resources',
    'server/uploads/general',
    'server/uploads/students',
    'server/uploads/teachers',
    'server/uploads/admins',
    'server/uploads/assignments',
    'server/uploads/results'
  ];

  for (const dir of directories) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }
}

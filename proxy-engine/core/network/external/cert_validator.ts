/**
 * Certificate Validator
 *
 * Validates TLS certificates from external services
 */

/**
 * Certificate information
 */
export interface CertificateInfo {
  subject: {
    commonName?: string;
    organization?: string;
    organizationalUnit?: string;
    locality?: string;
    state?: string;
    country?: string;
  };
  issuer: {
    commonName?: string;
    organization?: string;
    organizationalUnit?: string;
    locality?: string;
    state?: string;
    country?: string;
  };
  validFrom: Date;
  validTo: Date;
  serialNumber: string;
  fingerprint: string;
  subjectAltNames?: string[];
}

/**
 * Certificate validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  certificate?: CertificateInfo;
}

/**
 * Certificate validator options
 */
export interface CertificateValidatorOptions {
  checkExpiration?: boolean;
  checkHostname?: boolean;
  checkRevocation?: boolean;
  allowSelfSigned?: boolean;
  customTrustStore?: string[];
}

/**
 * Certificate validator
 */
export class CertificateValidator {
  private options: CertificateValidatorOptions;

  constructor(options: CertificateValidatorOptions = {}) {
    this.options = {
      checkExpiration: true,
      checkHostname: true,
      checkRevocation: false, // Expensive operation
      allowSelfSigned: false,
      ...options,
    };
  }

  /**
   * Validate certificate for hostname
   */
  async validate(
    hostname: string,
    port: number = 443,
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Connect with TLS to get certificate
      const conn = await Deno.connectTls({
        hostname,
        port,
      });

      try {
        // Get TLS handshake info
        const tlsInfo = await conn.handshake();

        // Basic validation checks
        if (this.options.checkExpiration) {
          // Note: Deno's TLS implementation already checks expiration
          // This is a placeholder for additional expiration checks
        }

        if (this.options.checkHostname) {
          // Note: Deno's TLS implementation already checks hostname
          // This is a placeholder for additional hostname verification
        }

        // Close connection
        conn.close();

        // Create validation result
        const result: ValidationResult = {
          valid: true,
          errors,
          warnings,
        };

        return result;
      } catch (handshakeError) {
        errors.push(
          `TLS handshake failed: ${
            handshakeError instanceof Error
              ? handshakeError.message
              : String(handshakeError)
          }`,
        );
        conn.close();
      }
    } catch (connectError) {
      errors.push(
        `Failed to connect to ${hostname}:${port}: ${
          connectError instanceof Error
            ? connectError.message
            : String(connectError)
        }`,
      );
    }

    return {
      valid: false,
      errors,
      warnings,
    };
  }

  /**
   * Validate certificate expiration
   */
  validateExpiration(validFrom: Date, validTo: Date): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const now = new Date();

    if (now < validFrom) {
      errors.push(`Certificate is not yet valid (valid from ${validFrom.toISOString()})`);
    }

    if (now > validTo) {
      errors.push(`Certificate has expired (expired on ${validTo.toISOString()})`);
    }

    // Warn if expiring soon (within 30 days)
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    if (now <= validTo && validTo <= thirtyDaysFromNow) {
      warnings.push(`Certificate will expire soon (${validTo.toISOString()})`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate hostname against certificate
   */
  validateHostname(
    hostname: string,
    certCommonName: string,
    subjectAltNames: string[] = [],
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check common name
    if (this.matchHostname(hostname, certCommonName)) {
      return { valid: true, errors };
    }

    // Check subject alternative names
    for (const altName of subjectAltNames) {
      if (this.matchHostname(hostname, altName)) {
        return { valid: true, errors };
      }
    }

    errors.push(
      `Hostname ${hostname} does not match certificate (CN: ${certCommonName}, SANs: ${
        subjectAltNames.join(", ") || "none"
      })`,
    );

    return { valid: false, errors };
  }

  /**
   * Match hostname against certificate name (supports wildcards)
   */
  private matchHostname(hostname: string, certName: string): boolean {
    // Exact match
    if (hostname.toLowerCase() === certName.toLowerCase()) {
      return true;
    }

    // Wildcard match (*.example.com)
    if (certName.startsWith("*.")) {
      const certDomain = certName.substring(2);
      const hostParts = hostname.toLowerCase().split(".");
      const certParts = certDomain.toLowerCase().split(".");

      // Wildcard only matches one level
      if (hostParts.length === certParts.length + 1) {
        const hostDomain = hostParts.slice(1).join(".");
        return hostDomain === certDomain.toLowerCase();
      }
    }

    return false;
  }

  /**
   * Parse X.509 certificate
   * Note: This is a simplified implementation
   * A full implementation would use ASN.1 parser
   */
  parseCertificate(certPEM: string): CertificateInfo | null {
    // This is a placeholder
    // A real implementation would parse the certificate using ASN.1
    // For now, we rely on Deno's TLS implementation
    return null;
  }

  /**
   * Check if certificate is self-signed
   */
  isSelfSigned(cert: CertificateInfo): boolean {
    // Compare subject and issuer
    return (
      cert.subject.commonName === cert.issuer.commonName &&
      cert.subject.organization === cert.issuer.organization &&
      cert.subject.country === cert.issuer.country
    );
  }

  /**
   * Check certificate revocation status
   * Note: This would typically check CRL or OCSP
   */
  async checkRevocation(
    certificate: CertificateInfo,
  ): Promise<{ revoked: boolean; reason?: string }> {
    // Placeholder for revocation checking
    // A real implementation would:
    // 1. Parse CRL Distribution Points from certificate
    // 2. Download and check CRL
    // 3. Or use OCSP to check revocation status

    // For now, assume not revoked
    return { revoked: false };
  }

  /**
   * Get certificate from server
   */
  async getCertificate(
    hostname: string,
    port: number = 443,
  ): Promise<CertificateInfo | null> {
    try {
      const conn = await Deno.connectTls({
        hostname,
        port,
      });

      try {
        await conn.handshake();
        // Note: Deno doesn't expose the certificate directly yet
        // This is a placeholder for when that functionality is available
        return null;
      } finally {
        conn.close();
      }
    } catch {
      return null;
    }
  }
}

/**
 * Global certificate validator
 */
export const globalCertValidator = new CertificateValidator();

/**
 * Quick validation helper
 */
export async function validateCertificate(
  hostname: string,
  port: number = 443,
  options?: CertificateValidatorOptions,
): Promise<ValidationResult> {
  const validator = new CertificateValidator(options);
  return await validator.validate(hostname, port);
}

export function checkLicense(): { valid: boolean; message?: string } {
  const licenseKey = process.env.LICENSE_KEY;
  
  if (!licenseKey || licenseKey.trim() === '') {
    return {
      valid: false,
      message: 'Unlicensed installation – Contact vendor'
    };
  }
  
  return { valid: true };
}

export function isLicensed(): boolean {
  return checkLicense().valid;
}

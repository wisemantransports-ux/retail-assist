// Do NOT import fs/path at module top-level. They will be imported lazily only when needed.

export interface BrandConfig {
  name: string;
  tagline: string;
  logo: string;
  favicon: string;
  primaryColor: string;
  accentColor: string;
  supportEmail: string;
  domain: string;
  company: string;
  socialLinks: {
    twitter?: string;
    facebook?: string;
    linkedin?: string;
  };
}

const DEFAULT_BRAND: BrandConfig = {
  name: "Retail Assist",
  tagline: "AI-Powered Customer Automation",
  logo: "/logo.png",
  favicon: "/favicon.ico",
  primaryColor: "#2563EB",
  accentColor: "#10B981",
  supportEmail: "support@example.com",
  domain: "example.com",
  company: "Your Company",
  socialLinks: {
    twitter: "",
    facebook: "",
    linkedin: ""
  }
};

// Get path to config file lazily
async function getBrandConfigPath(): Promise<string> {
  const path = await import('path');
  return path.join(process.cwd(), '.data', 'branding.json');
}

// Ensure .data directory exists
async function ensureDataDir(): Promise<void> {
  const fs = await import('fs');
  const path = await import('path');
  const dataDir = path.join(process.cwd(), '.data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

export async function getBrand(): Promise<BrandConfig> {
  try {
    const fs = await import('fs');
    const brandPath = await getBrandConfigPath();
    await ensureDataDir();
    if (fs.existsSync(brandPath)) {
      const data = fs.readFileSync(brandPath, 'utf-8');
      return { ...DEFAULT_BRAND, ...JSON.parse(data) };
    }
  } catch (error) {
    console.error('[Branding] Error reading brand config:', error);
  }
  return DEFAULT_BRAND;
}

export async function saveBrand(brand: Partial<BrandConfig>): Promise<BrandConfig> {
  try {
    const fs = await import('fs');
    await ensureDataDir();
    const current = await getBrand();
    const updated = { ...current, ...brand };
    const brandPath = await getBrandConfigPath();
    fs.writeFileSync(brandPath, JSON.stringify(updated, null, 2));
    return updated;
  } catch (error) {
    console.error('[Branding] Error saving brand config:', error);
    throw error;
  }
}
